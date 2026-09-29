namespace Autograt.Api.Models;

/// <summary>A browser or device a user has enabled reminders on, as given by the browser's Push API.</summary>
public class PushSubscription : ICreatedAtUtc
{
    public int Id { get; set; }

    public int UserId { get; set; }

    /// <summary>The push service URL for this browser; unique, since a browser has one endpoint.</summary>
    public required string Endpoint { get; set; }

    /// <summary>The browser's public key for encrypting messages.</summary>
    public required string P256dh { get; set; }

    /// <summary>The browser's authentication secret for encrypting messages.</summary>
    public required string Auth { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public User? User { get; set; }
}
