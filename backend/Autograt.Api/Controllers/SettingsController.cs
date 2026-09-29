using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Autograt.Api.Controllers;

/// <summary>The signed-in user's preferences, such as their theme.</summary>
[ApiController]
[Route("api/settings")]
public class SettingsController(SettingsService settingsService) : ControllerBase
{
    [HttpGet]
    public Task<List<SettingResponse>> GetAll() => settingsService.GetAllAsync(User.GetUserId());

    /// <param name="setting">The setting's name, e.g. "BrightnessTheme".</param>
    [HttpPut("{setting}")]
    public async Task<ActionResult<SettingResponse>> Update(string setting, UpdateSettingRequest request)
    {
        // Bound as a string so an unknown setting is a missing resource (404) rather than a validation error.
        if (Enum.TryParse<Setting>(setting, ignoreCase: true, out var parsed) == false || Enum.IsDefined(parsed) == false)
        {
            return NotFound();
        }

        var error = SettingDefinitions.For(parsed).Validate(request.Values);
        if (error is not null)
        {
            ModelState.AddModelError(nameof(request.Values), error);
            return ValidationProblem(ModelState);
        }

        return await settingsService.UpdateAsync(User.GetUserId(), parsed, request.Values);
    }
}
