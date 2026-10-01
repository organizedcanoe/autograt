namespace Autograt.Api.Models;

public class User : ICreatedAtUtc
{
    public int Id { get; set; }

    public required string Username { get; set; }

    public required string PasswordHash { get; set; }

    public UserRole Role { get; set; }

    /// <summary>
    /// A random value copied into every token. Replacing it ends every session issued before, e.g. after a password change.
    /// </summary>
    public string SecurityStamp { get; set; } = NewSecurityStamp();

    /// <summary>Set when an admin resets the password; the user is asked to choose a new one after logging in.</summary>
    public bool MustChangePassword { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    /// <summary>The reminder slot most recently handled (sent or skipped), so each slot is handled once.</summary>
    public DateTime? LastReminderAtUtc { get; set; }

    public List<JournalEntry> JournalEntries { get; } = [];

    public static string NewSecurityStamp() => Guid.NewGuid().ToString("N");
}
