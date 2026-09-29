using System.Net;
using System.Net.Http.Json;
using Autograt.Api.RateLimiting;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

// Each test builds its own factory so it can pick limits small enough to reach.
public class RateLimitingTests : IDisposable
{
    private const int HighLimit = 1000;

    private AutogratApiFactory? _factory;

    public void Dispose() => _factory?.Dispose();

    [Fact]
    public async Task Login_OverAuthLimit_Returns429WithRetryAfter()
    {
        var client = CreateFactory(authPermits: 2).CreateClient();

        await LoginAsync(client);
        await LoginAsync(client);
        var response = await LoginAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.NotNull(response.Headers.RetryAfter?.Delta);
        var problem = await response.Content.ReadFromJsonAsync<ProblemTitle>(TestJson.Options);
        Assert.StartsWith("Too many requests.", problem!.Title);
    }

    [Fact]
    public async Task AnonymousRequests_AreLimitedPerForwardedClientIp()
    {
        CreateFactory(authPermits: 2);
        var first = ClientFrom("203.0.113.1");
        var second = ClientFrom("203.0.113.2");

        await LoginAsync(first);
        await LoginAsync(first);
        var firstBlocked = await LoginAsync(first);
        var secondAllowed = await LoginAsync(second);

        Assert.Equal(HttpStatusCode.TooManyRequests, firstBlocked.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, secondAllowed.StatusCode);
    }

    [Fact]
    public async Task SignedInRequests_AreLimitedPerUser()
    {
        var factory = CreateFactory(userPermits: 5);
        var alice = await factory.CreateAuthenticatedClientAsync("alice");
        var bob = await factory.CreateAuthenticatedClientAsync("bob");

        for (var i = 0; i < 5; i++)
        {
            (await alice.GetAsync("/api/auth/me")).EnsureSuccessStatusCode();
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await alice.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await bob.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task AnonymousLimit_DoesNotBlockSignedInUserOnSameIp()
    {
        var factory = CreateFactory(anonymousPermits: 5);
        var user = await factory.CreateAuthenticatedClientAsync();
        var anonymous = factory.CreateClient();

        var blocked = false;
        for (var i = 0; i < 5 && blocked == false; i++)
        {
            blocked = (await anonymous.GetAsync("/api/health")).StatusCode == HttpStatusCode.TooManyRequests;
        }

        Assert.True(blocked);
        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/auth/me")).StatusCode);
    }

    private AutogratApiFactory CreateFactory(
        int authPermits = HighLimit, int anonymousPermits = HighLimit, int userPermits = HighLimit)
    {
        _factory = new AutogratApiFactory
        {
            RateLimits = new RateLimitingOptions
            {
                AuthPermitsPerMinute = authPermits,
                AnonymousPermitsPerMinute = anonymousPermits,
                UserPermitsPerMinute = userPermits,
            },
        };
        return _factory;
    }

    private HttpClient ClientFrom(string ipAddress)
    {
        var client = _factory!.CreateClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-For", ipAddress);
        return client;
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/auth/login", new { username = "nobody", password = "wrong-password" });

    private record ProblemTitle(string Title);
}
