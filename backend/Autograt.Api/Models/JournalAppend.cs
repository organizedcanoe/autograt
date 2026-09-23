namespace Autograt.Api.Models;

/// <summary>
/// An immutable note appended to an existing <see cref="JournalSubEntry"/>.
/// </summary>
public class JournalAppend : ICreatedAtUtc
{
    public int Id { get; set; }

    public int JournalSubEntryId { get; set; }

    public required string Content { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public JournalSubEntry? JournalSubEntry { get; set; }
}
