using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Autograt.Api.Controllers;

/// <summary>
/// Journal endpoints for the signed-in user. Only today's rating and sub-entries can be edited:
/// past days are read-only apart from new appends, and appends are immutable once written.
/// </summary>
[ApiController]
[Route("api/journal")]
public class JournalController(JournalService journalService, SearchService searchService) : ControllerBase
{
    [HttpGet("entries/{date}")]
    public async Task<ActionResult<DayDetailResponse>> GetDay(DateOnly date)
    {
        var day = await journalService.GetDayAsync(User.GetUserId(), date);
        return day is null ? NotFound() : day;
    }

    [HttpPost("entries/{date}/sub-entries")]
    public async Task<ActionResult<SubEntryResponse>> AddSubEntry(DateOnly date, SubEntryRequest request)
    {
        var result = await journalService.AddSubEntryAsync(User.GetUserId(), date, request);
        return result.IsSuccess ? StatusCode(StatusCodes.Status201Created, result.Value) : Failure(result.Error.Value);
    }

    [HttpPut("entries/{date}/rating")]
    public async Task<ActionResult<DayDetailResponse>> UpdateRating(DateOnly date, UpdateRatingRequest request)
    {
        var result = await journalService.UpdateRatingAsync(User.GetUserId(), date, request.DayRating!.Value);
        return result.IsSuccess ? result.Value : Failure(result.Error.Value);
    }

    [HttpPut("sub-entries/{subEntryId:int}")]
    public async Task<ActionResult<SubEntryResponse>> UpdateSubEntry(int subEntryId, SubEntryRequest request)
    {
        var result = await journalService.UpdateSubEntryAsync(User.GetUserId(), subEntryId, request);
        return result.IsSuccess ? result.Value : Failure(result.Error.Value);
    }

    [HttpPost("sub-entries/{subEntryId:int}/appends")]
    public async Task<ActionResult<AppendResponse>> AddAppend(int subEntryId, CreateAppendRequest request)
    {
        var append = await journalService.AddAppendAsync(User.GetUserId(), subEntryId, request);
        return append is null ? NotFound() : StatusCode(StatusCodes.Status201Created, append);
    }

    /// <summary>Returns one item per day from <paramref name="from"/> to <paramref name="to"/>, both inclusive.</summary>
    [HttpGet("heatmap")]
    public async Task<ActionResult<List<HeatmapDayResponse>>> GetHeatmap(
        [FromQuery, BindRequired] DateOnly from, [FromQuery, BindRequired] DateOnly to)
    {
        if (from > to)
        {
            ModelState.AddModelError(nameof(from), "The start date must not be after the end date.");
            return ValidationProblem(ModelState);
        }

        if (to.DayNumber - from.DayNumber + 1 > JournalService.MaxHeatmapDays)
        {
            ModelState.AddModelError(nameof(to), $"The heatmap covers at most {JournalService.MaxHeatmapDays} days.");
            return ValidationProblem(ModelState);
        }

        return await journalService.GetHeatmapAsync(User.GetUserId(), from, to);
    }

    [HttpGet("search")]
    public async Task<ActionResult<List<SearchResultResponse>>> Search([FromQuery] string? q)
    {
        var query = SearchQueryParser.Parse(q);
        if (query.IsEmpty)
        {
            ModelState.AddModelError(nameof(q), "Enter something to search for.");
            return ValidationProblem(ModelState);
        }

        return await searchService.SearchAsync(User.GetUserId(), query);
    }

    private ActionResult Failure(ServiceError error) => error switch
    {
        ServiceError.NotFound => NotFound(),
        ServiceError.ReadOnly => BadRequest(new ProblemDetails { Title = "Past days are read-only. You can still append notes." }),
        _ => throw new ArgumentOutOfRangeException(nameof(error), error, null),
    };
}
