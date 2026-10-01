namespace Autograt.Api.Models;

/// <summary>
/// A note appended to an existing <see cref="JournalSubEntry"/>. It is never edited, and can be deleted only while its day is today.
/// </summary>
public class JournalAppend : ICreatedAtUtc
{
    public int Id { get; set; }

    public int JournalSubEntryId { get; set; }

    public required string Content { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public JournalSubEntry? JournalSubEntry { get; set; }
}
