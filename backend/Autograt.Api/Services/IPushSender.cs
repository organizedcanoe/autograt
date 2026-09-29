using Autograt.Api.Models;

namespace Autograt.Api.Services;

/// <summary>A notification's content, sent to the service worker as JSON.</summary>
public sealed record PushMessage(string Title, string Body, string Url);

public enum PushSendResult
{
    Sent,

    /// <summary>The push service no longer knows the subscription (404/410), so it should be deleted.</summary>
    Gone,

    Failed,
}

/// <summary>Delivers a message to one browser through its push service.</summary>
public interface IPushSender
{
    Task<PushSendResult> SendAsync(PushSubscription subscription, PushMessage message, CancellationToken cancellationToken = default);
}
