namespace Autograt.Api.Models;

public class User : ICreatedAtUtc
{
    public int Id { get; set; }

    public required string Username { get; set; }

    public required string PasswordHash { get; set; }

    public UserRole Role { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    /// <summary>The reminder slot most recently handled (sent or skipped), so each slot is handled once.</summary>
    public DateTime? LastReminderAtUtc { get; set; }

    public List<JournalEntry> JournalEntries { get; } = [];
}
