using System.ComponentModel.DataAnnotations;
using Autograt.Api.Models;

namespace Autograt.Api.Contracts;

public sealed record UpdateSettingRequest
{
    [Required]
    public List<string> Values { get; init; } = [];
}

public sealed record SettingResponse(Setting Setting, IReadOnlyList<string> Values);
