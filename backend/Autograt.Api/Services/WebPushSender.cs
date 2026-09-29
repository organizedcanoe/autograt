using System.Net;
using System.Text.Json;
using WebPush;

namespace Autograt.Api.Services;

/// <summary>Sends encrypted, VAPID-signed messages with the WebPush library.</summary>
public sealed class WebPushSender(WebPushClient client, VapidDetails vapidDetails, ILogger<WebPushSender> logger) : IPushSender
{
    private static readonly JsonSerializerOptions PayloadOptions = new(JsonSerializerDefaults.Web);

    public async Task<PushSendResult> SendAsync(
        Models.PushSubscription subscription, PushMessage message, CancellationToken cancellationToken = default)
    {
        var target = new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth);
        var payload = JsonSerializer.Serialize(message, PayloadOptions);

        try
        {
            await client.SendNotificationAsync(target, payload, vapidDetails, cancellationToken);
            return PushSendResult.Sent;
        }
        catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
        {
            return PushSendResult.Gone;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not send a push message to subscription {SubscriptionId}.", subscription.Id);
            return PushSendResult.Failed;
        }
    }
}
