using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Autograt.Api.Controllers;

/// <summary>Server-wide settings, such as whether registration is open.</summary>
[ApiController]
[Route("api/admin/settings")]
[Authorize(Roles = AuthClaims.AdminRole)]
public class AdminSettingsController(AppSettingsService appSettingsService) : ControllerBase
{
    [HttpGet]
    public async Task<AppSettingsResponse> Get() => new(await appSettingsService.IsRegistrationOpenAsync());

    [HttpPut]
    public async Task<AppSettingsResponse> Update(UpdateAppSettingsRequest request)
    {
        await appSettingsService.SetRegistrationOpenAsync(request.RegistrationOpen!.Value);
        return await Get();
    }
}
