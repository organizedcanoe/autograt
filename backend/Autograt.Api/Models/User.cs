namespace Autograt.Api.Models;

public class User : ICreatedAtUtc
{
    public int Id { get; set; }

    public required string Username { get; set; }

    public required string PasswordHash { get; set; }

    public bool IsAdmin { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public List<JournalEntry> JournalEntries { get; } = [];
}
