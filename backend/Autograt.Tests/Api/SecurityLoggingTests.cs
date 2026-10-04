using System.Net.Http.Json;
using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.RateLimiting;
using Autograt.Tests.Infrastructure;
using Microsoft.Extensions.Logging;

namespace Autograt.Tests.Api;

// Security events are logged so an admin can see what happened with `docker logs`.
public class SecurityLoggingTests : IDisposable
{
    private const string ClientIp = "203.0.113.7";

    private readonly AutogratApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Theory]
    [InlineData("claude", "cla***")]
    [InlineData("  claude  ", "cla***")]
    [InlineData("bob", "bob***")]
    [InlineData("al", "al***")]
    [InlineData("", "***")]
    public void MaskUsername_KeepsTheFirstThreeCharacters(string username, string expected)
    {
        Assert.Equal(expected, SecurityLogging.MaskUsername(username));
    }

    [Fact]
    public async Task FailedLogin_LogsAMaskedUsernameAndTheClientIp()
    {
        await _factory.CreateAuthenticatedClientAsync("billy");

        await ClientFromIp().PostAsJsonAsync("/api/auth/login", new { username = "billy", password = "wrong-password" });

        var entry = Assert.Single(_factory.Logs.Entries, e => e.Message.StartsWith("Failed login"));
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Contains("bil***", entry.Message);
        Assert.Contains(ClientIp, entry.Message);
        Assert.DoesNotContain("billy", entry.Message);
    }

    [Fact]
    public async Task Login_LogsTheUserAndTheClientIp()
    {
        await _factory.CreateAuthenticatedClientAsync("billy");

        await ClientFromIp().PostAsJsonAsync("/api/auth/login", new { username = "billy", password = AutogratApiFactory.DefaultPassword });

        Assert.Contains(_factory.Logs.Entries, e => e.Message.Contains("logged in") && e.Message.Contains(ClientIp));
    }

    [Fact]
    public async Task WrongCurrentPassword_IsLogged()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        await client.PutAsJsonAsync("/api/account/password", new { currentPassword = "not-my-password", newPassword = "a-brand-new-password" });

        Assert.Contains(_factory.Logs.Entries, e => e.Level == LogLevel.Warning && e.Message.Contains("wrong password"));
    }

    [Fact]
    public async Task SignOutEverywhere_IsLogged()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        await client.PostAsync("/api/account/sign-out-everywhere", null);

        Assert.Contains(_factory.Logs.Entries, e => e.Message.Contains("signed out everywhere"));
    }

    [Fact]
    public async Task AdminActions_LogTheAdminAndTheUser()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var adminId = (await admin.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options))!.Id;
        var register = await _factory.CreateClient().PostAsJsonAsync("/api/auth/register", new { username = "billy", password = AutogratApiFactory.DefaultPassword });
        var billy = await register.Content.ReadFromJsonAsync<UserResponse>(TestJson.Options);

        await admin.PostAsync($"/api/admin/users/{billy!.Id}/approve", null);
        await admin.PostAsync($"/api/admin/users/{billy.Id}/reset-password", null);

        Assert.Contains(_factory.Logs.Entries, e => e.Message == $"Admin {adminId} approved user {billy.Id}.");
        Assert.Contains(_factory.Logs.Entries, e => e.Message == $"Admin {adminId} reset the password of user {billy.Id}.");
    }

    [Fact]
    public async Task RateLimitedRequest_IsLogged()
    {
        using var factory = new AutogratApiFactory { RateLimits = new RateLimitingOptions { AuthPermitsPerMinute = 1, AnonymousPermitsPerMinute = 1000, UserPermitsPerMinute = 1000 } };
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-For", ClientIp);

        await client.PostAsJsonAsync("/api/auth/login", new { username = "nobody", password = "wrong-password" });
        await client.PostAsJsonAsync("/api/auth/login", new { username = "nobody", password = "wrong-password" });

        Assert.Contains(factory.Logs.Entries, e => e.Level == LogLevel.Warning && e.Message.StartsWith("Rate limited") && e.Message.Contains(ClientIp));
    }

    private HttpClient ClientFromIp()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-For", ClientIp);
        return client;
    }
}
