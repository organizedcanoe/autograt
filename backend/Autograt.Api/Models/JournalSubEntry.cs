namespace Autograt.Api.Models;

/// <summary>
/// An individual categorized log entry within a day. Its content is immutable once created.
/// </summary>
public class JournalSubEntry : ICreatedAtUtc
{
    public int Id { get; set; }

    public int JournalEntryId { get; set; }

    public EntryCategory Category { get; set; }

    public required string Content { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public JournalEntry? JournalEntry { get; set; }

    public List<JournalAppend> Appends { get; } = [];
}
