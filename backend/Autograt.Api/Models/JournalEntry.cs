namespace Autograt.Api.Models;

/// <summary>
/// The single daily record for a user on a given calendar day.
/// </summary>
public class JournalEntry : ICreatedAtUtc
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public DateOnly EntryDate { get; set; }

    /// <summary>Overall day assessment, 0–10.</summary>
    public int DayRating { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public User? User { get; set; }

    public List<JournalSubEntry> SubEntries { get; } = [];
}
