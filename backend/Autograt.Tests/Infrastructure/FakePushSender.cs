using System.Collections.Concurrent;
using Autograt.Api.Models;
using Autograt.Api.Services;

namespace Autograt.Tests.Infrastructure;

/// <summary>Records push messages instead of sending them. Endpoints in <see cref="GoneEndpoints"/> report as expired.</summary>
public sealed class FakePushSender : IPushSender
{
    private readonly ConcurrentQueue<(string Endpoint, PushMessage Message)> _sent = new();

    public ConcurrentDictionary<string, bool> GoneEndpoints { get; } = new();

    /// <summary>Every message sent so far, with the endpoint it went to.</summary>
    public IReadOnlyList<(string Endpoint, PushMessage Message)> Sent => [.. _sent];

    public IReadOnlyList<PushMessage> SentTo(string endpoint) =>
        Sent.Where(s => s.Endpoint == endpoint).Select(s => s.Message).ToList();

    public Task<PushSendResult> SendAsync(PushSubscription subscription, PushMessage message, CancellationToken cancellationToken = default)
    {
        if (GoneEndpoints.ContainsKey(subscription.Endpoint))
        {
            return Task.FromResult(PushSendResult.Gone);
        }

        _sent.Enqueue((subscription.Endpoint, message));
        return Task.FromResult(PushSendResult.Sent);
    }
}
