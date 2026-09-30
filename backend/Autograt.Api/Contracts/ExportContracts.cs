using System.ComponentModel.DataAnnotations;
using Autograt.Api.Models;

namespace Autograt.Api.Contracts;

/// <summary>
/// A user's whole journal and saved settings, as exported and imported. Database ids are left out so the file
/// can be imported into any server; the day → sub-entry → append hierarchy is nested instead.
/// Properties are nullable so a value missing from an imported file fails validation instead of defaulting.
/// </summary>
public sealed record JournalExport
{
    public const string FormatName = "autograt-export";
    public const int CurrentVersion = 1;

    [Required]
    public string? Format { get; init; }

    [Required]
    public int? Version { get; init; }

    public DateTime? ExportedAtUtc { get; init; }

    /// <summary>Informational only; an import always goes into the signed-in user's account.</summary>
    public string? Username { get; init; }

    /// <summary>Only the settings the user has saved; defaults are left out.</summary>
    [Required]
    public List<ExportedSetting> Settings { get; init; } = [];

    [Required]
    public List<ExportedDay> Entries { get; init; } = [];
}

public sealed record ExportedSetting
{
    [Required, EnumDataType(typeof(Setting))]
    public Setting? Setting { get; init; }

    [Required]
    public List<string> Values { get; init; } = [];
}

public sealed record ExportedDay
{
    [Required]
    public DateOnly? Date { get; init; }

    [Range(0, 10)]
    public int? Rating { get; init; }

    [Required]
    public DateTime? CreatedAtUtc { get; init; }

    [Required]
    public List<ExportedSubEntry> SubEntries { get; init; } = [];
}

public sealed record ExportedSubEntry
{
    [Required, EnumDataType(typeof(EntryCategory))]
    public EntryCategory? Category { get; init; }

    [Required]
    public string Content { get; init; } = "";

    [Required]
    public DateTime? CreatedAtUtc { get; init; }

    [Required]
    public List<ExportedAppend> Appends { get; init; } = [];
}

public sealed record ExportedAppend
{
    [Required]
    public string Content { get; init; } = "";

    [Required]
    public DateTime? CreatedAtUtc { get; init; }
}

/// <param name="ImportedDays">Every day in the file, including the replaced ones.</param>
/// <param name="ReplacedDays">Days the user already had, which the file's version replaced.</param>
/// <param name="SettingsImported">How many settings the file set.</param>
public sealed record ImportResponse(int ImportedDays, IReadOnlyList<DateOnly> ReplacedDays, int SettingsImported);
