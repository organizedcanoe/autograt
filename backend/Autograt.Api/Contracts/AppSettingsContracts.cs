using System.ComponentModel.DataAnnotations;

namespace Autograt.Api.Contracts;

public sealed record AppSettingsResponse(bool RegistrationOpen);

public sealed record UpdateAppSettingsRequest
{
    [Required]
    public bool? RegistrationOpen { get; init; }
}

/// <summary>Whether the login page should offer registration.</summary>
public sealed record RegistrationStatusResponse(bool Open);
