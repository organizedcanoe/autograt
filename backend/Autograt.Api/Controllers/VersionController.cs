using System.Reflection;
using Autograt.Api.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Autograt.Api.Controllers;

/// <summary>The running backend build, so the UI can show it and spot a stale container.</summary>
[ApiController]
[AllowAnonymous]
[Route("api/version")]
public class VersionController(IConfiguration configuration) : ControllerBase
{
    private static readonly string? InformationalVersion = typeof(VersionController).Assembly
        .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;

    [HttpGet]
    public VersionResponse Get() => VersionResponse.FromBuild(InformationalVersion, configuration["BUILD_DATE"]);
}
