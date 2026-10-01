using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Autograt.Api.Services;
using Autograt.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;

namespace Autograt.Tests.Api;

// A fresh factory (and database) per test, so the first registered user is always the admin.
public class AccountEndpointsTests : IDisposable
{
    private const string NewPassword = "a-brand-new-password";

    private readonly AutogratApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Theory]
    [InlineData("PUT", "/api/account/password")]
    [InlineData("PUT", "/api/account/username")]
    [InlineData("DELETE", "/api/account")]
    public async Task Endpoint_WithoutToken_Returns401(string method, string url)
    {
        var response = await _factory.CreateClient().SendAsync(
            new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_ReturnsWorkingToken_AndEndsOtherSessions()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");
        var otherDevice = await LogInAsync("billy", AutogratApiFactory.DefaultPassword);

        var response = await ChangePasswordAsync(client, AutogratApiFactory.DefaultPassword, NewPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);
        Assert.Equal(HttpStatusCode.OK, (await WithToken(session!.Token).GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await WithToken(otherDevice).GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_NewPasswordLogsIn_OldDoesNot()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        await ChangePasswordAsync(client, AutogratApiFactory.DefaultPassword, NewPassword);

        Assert.Equal(HttpStatusCode.OK, (await PostLoginAsync("billy", NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await PostLoginAsync("billy", AutogratApiFactory.DefaultPassword)).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WrongCurrentPassword_Returns400_AndKeepsSession()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await ChangePasswordAsync(client, "not-my-password", NewPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Theory]
    [InlineData("short")]
    [InlineData(AutogratApiFactory.DefaultPassword)]
    public async Task ChangePassword_InvalidNewPassword_Returns400(string newPassword)
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await ChangePasswordAsync(client, AutogratApiFactory.DefaultPassword, newPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeUsername_ReturnsToken_AndNewNameLogsIn()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await client.PutAsJsonAsync("/api/account/username", new { username = "  william  " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);
        Assert.Equal("william", session!.User.Username);
        Assert.Equal(HttpStatusCode.OK, (await PostLoginAsync("william", AutogratApiFactory.DefaultPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await PostLoginAsync("billy", AutogratApiFactory.DefaultPassword)).StatusCode);
    }

    [Fact]
    public async Task ChangeUsername_KeepsOtherSessions()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        await client.PutAsJsonAsync("/api/account/username", new { username = "william" });

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ChangeUsername_CaseOnlyChangeOfOwnName_Succeeds()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await client.PutAsJsonAsync("/api/account/username", new { username = "Billy" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);
        Assert.Equal("Billy", session!.User.Username);
    }

    [Fact]
    public async Task ChangeUsername_TakenInAnyCase_Returns409()
    {
        await _factory.CreateAuthenticatedClientAsync("admin");
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await client.PutAsJsonAsync("/api/account/username", new { username = "ADMIN" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("a-username-that-is-much-longer-than-fifty-characters")]
    public async Task ChangeUsername_Invalid_Returns400(string username)
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await client.PutAsJsonAsync("/api/account/username", new { username });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_WrongPassword_Returns400_AndKeepsAccount()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await DeleteAccountAsync(client, "not-my-password");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_RemovesUserAndAllTheirData_AndEndsSession()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var client = await _factory.CreateAuthenticatedClientAsync("billy");
        var userId = (await client.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options))!.Id;
        await SeedDataAsync(admin, "admin");
        await SeedDataAsync(client, "billy");

        var response = await DeleteAccountAsync(client, AutogratApiFactory.DefaultPassword);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await PostLoginAsync("billy", AutogratApiFactory.DefaultPassword)).StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AutogratDbContext>();
        Assert.False(await db.Users.AnyAsync(u => u.Id == userId));
        Assert.False(await db.JournalEntries.AnyAsync(e => e.UserId == userId));
        Assert.Single(await db.JournalEntries.ToListAsync());
        Assert.Single(await db.JournalSubEntries.ToListAsync());
        Assert.Single(await db.JournalAppends.ToListAsync());
        Assert.False(await db.UserSettings.AnyAsync(s => s.UserId == userId));
        Assert.False(await db.PushSubscriptions.AnyAsync(s => s.UserId == userId));
        Assert.True(await db.PushSubscriptions.AnyAsync());
    }

    [Fact]
    public async Task DeleteAccount_LastAdminWithOtherUsers_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await DeleteAccountAsync(admin, AutogratApiFactory.DefaultPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_AdminWithAnotherAdmin_Returns204()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var other = await _factory.CreateAuthenticatedClientAsync("other");
        var otherId = (await other.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options))!.Id;
        await admin.PostAsync($"/api/admin/users/{otherId}/promote", null);

        var response = await DeleteAccountAsync(admin, AutogratApiFactory.DefaultPassword);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_OnlyUser_Returns204()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var response = await DeleteAccountAsync(admin, AutogratApiFactory.DefaultPassword);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Token_WithoutSecurityStamp_Returns401()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");
        var userId = (await client.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options))!.Id;
        var signingKey = _factory.Services.GetRequiredService<JwtSigningKey>();

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([new Claim(AuthClaims.UserId, userId.ToString())]),
            Issuer = TokenService.Issuer,
            Audience = TokenService.Audience,
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(signingKey.Key, SecurityAlgorithms.HmacSha256),
        });

        Assert.Equal(HttpStatusCode.Unauthorized, (await WithToken(token).GetAsync("/api/auth/me")).StatusCode);
    }

    private static Task<HttpResponseMessage> ChangePasswordAsync(HttpClient client, string currentPassword, string newPassword) =>
        client.PutAsJsonAsync("/api/account/password", new { currentPassword, newPassword });

    private static Task<HttpResponseMessage> DeleteAccountAsync(HttpClient client, string password) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password }) });

    private Task<HttpResponseMessage> PostLoginAsync(string username, string password) =>
        _factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { username, password });

    private async Task<string> LogInAsync(string username, string password)
    {
        var response = await PostLoginAsync(username, password);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options))!.Token;
    }

    private HttpClient WithToken(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>One day with a sub-entry and an append, a saved setting and a push subscription.</summary>
    private async Task SeedDataAsync(HttpClient client, string username)
    {
        var subEntry = await client.AddSubEntryAsync(TestClock.DefaultToday, "Good", $"{username}'s entry");
        (await client.PostAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}/appends", new { content = "Later" }))
            .EnsureSuccessStatusCode();

        (await client.PutAsJsonAsync("/api/settings/BrightnessTheme", new { values = new[] { "dark" } })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/push/subscriptions", new
        {
            endpoint = $"https://push.example.com/{username}",
            keys = new { p256dh = "p256dh-key", auth = "auth-secret" },
        })).EnsureSuccessStatusCode();
    }
}
