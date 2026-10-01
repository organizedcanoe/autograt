namespace Autograt.Api.Models;

/// <summary>
/// An individual categorized log entry within a day. It can be edited or deleted only while its day is today.
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
