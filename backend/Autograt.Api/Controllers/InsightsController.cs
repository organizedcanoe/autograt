using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Autograt.Api.Controllers;

/// <summary>Summary statistics of the signed-in user's journal.</summary>
[ApiController]
[Route("api/insights")]
public class InsightsController(InsightsService insightsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<InsightsResponse>> Get() => await insightsService.GetInsightsAsync(User.GetUserId());
}
