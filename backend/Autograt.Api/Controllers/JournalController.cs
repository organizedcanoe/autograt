using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Autograt.Api.Controllers;

/// <summary>
/// Journal endpoints for the signed-in user. There are deliberately no PUT or PATCH routes:
/// sub-entries and appends are immutable once written.
/// </summary>
[ApiController]
[Route("api/journal")]
public class JournalController(JournalService journalService, SearchService searchService) : ControllerBase
{
    [HttpPost("entries")]
    public async Task<ActionResult<DayDetailResponse>> CreateEntry(CreateEntryRequest request)
    {
        var result = await journalService.CreateEntryAsync(User.GetUserId(), request);
        if (result.IsConflict)
        {
            return Conflict(new ProblemDetails { Title = "An entry already exists for this date." });
        }

        return CreatedAtAction(nameof(GetDay), new { date = result.Value.EntryDate.ToString("yyyy-MM-dd") }, result.Value);
    }

    [HttpGet("entries/{date}")]
    public async Task<ActionResult<DayDetailResponse>> GetDay(DateOnly date)
    {
        var day = await journalService.GetDayAsync(User.GetUserId(), date);
        return day is null ? NotFound() : day;
    }

    [HttpPost("entries/{date}/sub-entries")]
    public async Task<ActionResult<SubEntryResponse>> AddSubEntry(DateOnly date, CreateSubEntryRequest request)
    {
        var subEntry = await journalService.AddSubEntryAsync(User.GetUserId(), date, request);
        return subEntry is null ? NotFound() : StatusCode(StatusCodes.Status201Created, subEntry);
    }

    [HttpPost("sub-entries/{subEntryId:int}/appends")]
    public async Task<ActionResult<AppendResponse>> AddAppend(int subEntryId, CreateAppendRequest request)
    {
        var append = await journalService.AddAppendAsync(User.GetUserId(), subEntryId, request);
        return append is null ? NotFound() : StatusCode(StatusCodes.Status201Created, append);
    }

    /// <param name="today">The client's local date; the heatmap covers the 30 days ending on it.</param>
    [HttpGet("heatmap")]
    public Task<List<HeatmapDayResponse>> GetHeatmap([FromQuery, BindRequired] DateOnly today) =>
        journalService.GetHeatmapAsync(User.GetUserId(), today);

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
}
