using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>Manages the browsers a user gets reminders on and sends messages to them.</summary>
public class PushService(AutogratDbContext db, IPushSender sender)
{
    /// <summary>
    /// Saves the browser's subscription for the user. A browser has one endpoint, so an existing subscription
    /// is updated, and moved to this user if another user enabled reminders on the same device before.
    /// </summary>
    public async Task SubscribeAsync(int userId, SubscribePushRequest request)
    {
        var subscription = await db.PushSubscriptions.SingleOrDefaultAsync(s => s.Endpoint == request.Endpoint);
        if (subscription is null)
        {
            subscription = new PushSubscription { Endpoint = request.Endpoint, P256dh = "", Auth = "" };
            db.PushSubscriptions.Add(subscription);
        }

        subscription.UserId = userId;
        subscription.P256dh = request.Keys!.P256dh;
        subscription.Auth = request.Keys.Auth;
        await db.SaveChangesAsync();
    }

    /// <returns>False if the user has no subscription with this endpoint.</returns>
    public async Task<bool> UnsubscribeAsync(int userId, string endpoint)
    {
        var deleted = await db.PushSubscriptions
            .Where(s => s.UserId == userId && s.Endpoint == endpoint)
            .ExecuteDeleteAsync();
        return deleted > 0;
    }

    /// <summary>
    /// Sends the message to every browser the user subscribed. Subscriptions the push service no longer knows
    /// are deleted; other failures are logged by the sender and skipped.
    /// </summary>
    public async Task SendToUserAsync(int userId, PushMessage message, CancellationToken cancellationToken = default)
    {
        var subscriptions = await db.PushSubscriptions.Where(s => s.UserId == userId).ToListAsync(cancellationToken);
        foreach (var subscription in subscriptions)
        {
            if (await sender.SendAsync(subscription, message, cancellationToken) == PushSendResult.Gone)
            {
                db.PushSubscriptions.Remove(subscription);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
