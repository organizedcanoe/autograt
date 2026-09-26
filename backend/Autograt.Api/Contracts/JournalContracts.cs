using System.ComponentModel.DataAnnotations;
using Autograt.Api.Models;

namespace Autograt.Api.Contracts;

/// <summary>A sub-entry to add to a day, or the new category and content of an existing one.</summary>
public sealed record SubEntryRequest
{
    [Required, EnumDataType(typeof(EntryCategory))]
    public EntryCategory? Category { get; init; }

    [Required]
    public string Content { get; init; } = "";
}

public sealed record UpdateRatingRequest
{
    /// <summary>Nullable so an omitted rating fails validation instead of defaulting to 0.</summary>
    [Required, Range(0, 10)]
    public int? DayRating { get; init; }
}

public sealed record CreateAppendRequest
{
    [Required]
    public string Content { get; init; } = "";
}

public sealed record DayDetailResponse(DateOnly EntryDate, int? DayRating, IReadOnlyList<SubEntryResponse> SubEntries);

public sealed record SubEntryResponse(
    int Id,
    EntryCategory Category,
    string Content,
    DateTime CreatedAtUtc,
    IReadOnlyList<AppendResponse> Appends);

public sealed record AppendResponse(int Id, int SubEntryId, string Content, DateTime CreatedAtUtc);

public sealed record HeatmapDayResponse(DateOnly Date, int? DayRating, int EntryCount);

public enum SearchResultType
{
    SubEntry,
    Append,
}

public sealed record SearchResultResponse(
    SearchResultType Type,
    int SubEntryId,
    int? AppendId,
    EntryCategory Category,
    string Content,
    DateOnly EntryDate,
    DateTime CreatedAtUtc);
