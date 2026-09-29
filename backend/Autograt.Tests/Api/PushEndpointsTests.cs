using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Autograt.Tests.Api;

public class PushEndpointsTests : IClassFixture<AutogratApiFactory>
{
    private readonly AutogratApiFactory _factory;

    public PushEndpointsTests(AutogratApiFactory factory) => _factory = factory;

    [Theory]
    [InlineData("GET", "/api/push/public-key")]
    [InlineData("POST", "/api/push/subscriptions")]
    [InlineData("DELETE", "/api/push/subscriptions")]
    [InlineData("POST", "/api/push/test")]
    public async Task Endpoints_WithoutToken_Return401(string method, string url)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) };

        var response = await _factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetPublicKey_ReturnsTheVapidPublicKey()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.GetFromJsonAsync<PushPublicKeyResponse>("/api/push/public-key", TestJson.Options);

        Assert.False(string.IsNullOrEmpty(response!.PublicKey));
    }

    [Fact]
    public async Task Subscribe_CreatesASubscription()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        var endpoint = NewEndpoint();

        var response = await SubscribeAsync(client, endpoint);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var saved = await FindSubscriptionsAsync(endpoint);
        var subscription = Assert.Single(saved);
        Assert.Equal("p256dh-key", subscription.P256dh);
        Assert.Equal("auth-secret", subscription.Auth);
    }

    [Fact]
    public async Task Subscribe_SameEndpointAgain_UpdatesTheKeysWithoutADuplicate()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        var endpoint = NewEndpoint();

        await SubscribeAsync(client, endpoint);
        await SubscribeAsync(client, endpoint, p256dh: "new-p256dh", auth: "new-auth");

        var subscription = Assert.Single(await FindSubscriptionsAsync(endpoint));
        Assert.Equal("new-p256dh", subscription.P256dh);
        Assert.Equal("new-auth", subscription.Auth);
    }

    [Fact]
    public async Task Subscribe_EndpointOfAnotherUser_MovesItToTheCurrentUser()
    {
        var alice = await _factory.CreateAuthenticatedClientAsync();
        var bob = await _factory.CreateAuthenticatedClientAsync();
        var endpoint = NewEndpoint();

        await SubscribeAsync(alice, endpoint);
        var aliceUserId = Assert.Single(await FindSubscriptionsAsync(endpoint)).UserId;
        await SubscribeAsync(bob, endpoint);

        var subscription = Assert.Single(await FindSubscriptionsAsync(endpoint));
        Assert.NotEqual(aliceUserId, subscription.UserId);
    }

    public static TheoryData<object> InvalidSubscriptions => new()
    {
        new { keys = new { p256dh = "p", auth = "a" } },
        new { endpoint = "", keys = new { p256dh = "p", auth = "a" } },
        new { endpoint = "http://push.example.com/insecure", keys = new { p256dh = "p", auth = "a" } },
        new { endpoint = "not a url", keys = new { p256dh = "p", auth = "a" } },
        new { endpoint = "https://push.example.com/no-keys" },
        new { endpoint = "https://push.example.com/no-auth", keys = new { p256dh = "p" } },
        new { endpoint = "https://push.example.com/empty-p256dh", keys = new { p256dh = "", auth = "a" } },
    };

    [Theory]
    [MemberData(nameof(InvalidSubscriptions))]
    public async Task Subscribe_InvalidBody_Returns400(object body)
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync("/api/push/subscriptions", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Unsubscribe_OwnEndpoint_RemovesIt()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        var endpoint = NewEndpoint();
        await SubscribeAsync(client, endpoint);

        var response = await UnsubscribeAsync(client, endpoint);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await FindSubscriptionsAsync(endpoint));
    }

    [Fact]
    public async Task Unsubscribe_AnotherUsersEndpoint_Returns404AndKeepsIt()
    {
        var alice = await _factory.CreateAuthenticatedClientAsync();
        var bob = await _factory.CreateAuthenticatedClientAsync();
        var endpoint = NewEndpoint();
        await SubscribeAsync(alice, endpoint);

        var response = await UnsubscribeAsync(bob, endpoint);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Single(await FindSubscriptionsAsync(endpoint));
    }

    [Fact]
    public async Task Unsubscribe_MissingEndpoint_Returns400()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/push/subscriptions")
        {
            Content = JsonContent.Create(new { }),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendTest_SendsToEveryDeviceOfTheCurrentUserOnly()
    {
        var alice = await _factory.CreateAuthenticatedClientAsync();
        var bob = await _factory.CreateAuthenticatedClientAsync();
        var (phone, laptop, bobsPhone) = (NewEndpoint(), NewEndpoint(), NewEndpoint());
        await SubscribeAsync(alice, phone);
        await SubscribeAsync(alice, laptop);
        await SubscribeAsync(bob, bobsPhone);

        var response = await alice.PostAsync("/api/push/test", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Single(_factory.Push.SentTo(phone));
        Assert.Single(_factory.Push.SentTo(laptop));
        Assert.Empty(_factory.Push.SentTo(bobsPhone));
    }

    [Fact]
    public async Task SendTest_ExpiredSubscription_IsRemoved()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        var endpoint = NewEndpoint();
        await SubscribeAsync(client, endpoint);
        _factory.Push.GoneEndpoints[endpoint] = true;

        await client.PostAsync("/api/push/test", null);

        Assert.Empty(await FindSubscriptionsAsync(endpoint));
    }

    private static string NewEndpoint() => $"https://push.example.com/{Guid.NewGuid():N}";

    private static Task<HttpResponseMessage> SubscribeAsync(
        HttpClient client, string endpoint, string p256dh = "p256dh-key", string auth = "auth-secret") =>
        client.PostAsJsonAsync("/api/push/subscriptions", new { endpoint, keys = new { p256dh, auth } });

    private static Task<HttpResponseMessage> UnsubscribeAsync(HttpClient client, string endpoint) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/push/subscriptions")
        {
            Content = JsonContent.Create(new { endpoint }),
        });

    private async Task<List<PushSubscription>> FindSubscriptionsAsync(string endpoint)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AutogratDbContext>();
        return await db.PushSubscriptions.AsNoTracking().Where(s => s.Endpoint == endpoint).ToListAsync();
    }
}
