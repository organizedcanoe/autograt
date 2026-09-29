using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Autograt.Api.Controllers;

/// <summary>The browsers the signed-in user gets reminder notifications on.</summary>
[ApiController]
[Route("api/push")]
public class PushController(PushService pushService, VapidKeys vapidKeys) : ControllerBase
{
    /// <summary>The server's public key, which browsers need to subscribe.</summary>
    [HttpGet("public-key")]
    public PushPublicKeyResponse GetPublicKey() => new(vapidKeys.PublicKey);

    /// <summary>Saves this browser's subscription for the signed-in user.</summary>
    [HttpPost("subscriptions")]
    public async Task<IActionResult> Subscribe(SubscribePushRequest request)
    {
        await pushService.SubscribeAsync(User.GetUserId(), request);
        return NoContent();
    }

    [HttpDelete("subscriptions")]
    public async Task<IActionResult> Unsubscribe(UnsubscribePushRequest request) =>
        await pushService.UnsubscribeAsync(User.GetUserId(), request.Endpoint) ? NoContent() : NotFound();

    /// <summary>Sends a test notification to every browser the signed-in user subscribed.</summary>
    [HttpPost("test")]
    public async Task<IActionResult> SendTest(CancellationToken cancellationToken)
    {
        await pushService.SendToUserAsync(User.GetUserId(), ReminderMessages.Test, cancellationToken);
        return NoContent();
    }
}
