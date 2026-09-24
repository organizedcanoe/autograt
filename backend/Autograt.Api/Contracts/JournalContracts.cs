using System.ComponentModel.DataAnnotations;
using Autograt.Api.Models;

namespace Autograt.Api.Contracts;

public sealed record CreateEntryRequest
{
    /// <summary>The client's local calendar date for this entry.</summary>
    [Required]
    public DateOnly? EntryDate { get; init; }

    /// <summary>Nullable so an omitted rating fails validation instead of defaulting to 0.</summary>
    [Required, Range(0, 10)]
    public int? DayRating { get; init; }

    /// <summary>One item per form text box; items with blank content are skipped.</summary>
    public List<NewSubEntry> SubEntries { get; init; } = [];
}

public sealed record NewSubEntry
{
    [Required, EnumDataType(typeof(EntryCategory))]
    public EntryCategory? Category { get; init; }

    public string? Content { get; init; }
}

public sealed record CreateSubEntryRequest
{
    [Required, EnumDataType(typeof(EntryCategory))]
    public EntryCategory? Category { get; init; }

    [Required]
    public string Content { get; init; } = "";
}

public sealed record CreateAppendRequest
{
    [Required]
    public string Content { get; init; } = "";
}

public sealed record DayDetailResponse(DateOnly EntryDate, int DayRating, IReadOnlyList<SubEntryResponse> SubEntries);

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
