using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
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

namespace Autograt.Tests.Api;

// A fresh factory (and database) per test, since first-user-admin depends on an empty database.
public class AuthEndpointsTests : IDisposable
{
    private readonly AutogratApiFactory _factory = new();
    private readonly HttpClient _client;

    public AuthEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Register_Returns201_FirstUserIsAdmin_LaterUsersArePending()
    {
        var first = await _client.PostAsJsonAsync("/api/auth/register", new { username = "first", password = "password-one" });
        var second = await _client.PostAsJsonAsync("/api/auth/register", new { username = "second", password = "password-two" });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(UserRole.Admin, (await first.Content.ReadFromJsonAsync<UserResponse>(TestJson.Options))!.Role);
        Assert.Equal(UserRole.Pending, (await second.Content.ReadFromJsonAsync<UserResponse>(TestJson.Options))!.Role);
    }

    [Theory]
    [InlineData("", "password-one")]
    [InlineData("billy", "")]
    [InlineData("billy", "short")]
    public async Task Register_InvalidInput_Returns400(string username, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new { username, password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_DuplicateUsername_Returns409()
    {
        await _client.PostAsJsonAsync("/api/auth/register", new { username = "billy", password = "password-one" });

        var response = await _client.PostAsJsonAsync("/api/auth/register", new { username = "Billy", password = "password-two" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsTokenThatAuthenticatesMe()
    {
        await _client.PostAsJsonAsync("/api/auth/register", new { username = "billy", password = "password-one" });

        var login = await _client.PostAsJsonAsync("/api/auth/login", new { username = "billy", password = "password-one" });
        var session = await login.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal("billy", session!.User.Username);
        Assert.True(session.ExpiresAtUtc > DateTime.UtcNow);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.Token);
        var me = await _client.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);
        Assert.Equal(session.User.Id, me!.Id);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        await _client.PostAsJsonAsync("/api/auth/register", new { username = "billy", password = "password-one" });

        var response = await _client.PostAsJsonAsync("/api/auth/login", new { username = "billy", password = "wrong-password" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_PendingUser_Returns403()
    {
        await _client.PostAsJsonAsync("/api/auth/register", new { username = "admin", password = "password-one" });
        await _client.PostAsJsonAsync("/api/auth/register", new { username = "pending", password = "password-two" });

        var response = await _client.PostAsJsonAsync("/api/auth/login", new { username = "pending", password = "password-two" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_ReturnsWorkingTokenLasting30Days()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");

        var response = await client.PostAsync("/api/auth/refresh", null);
        var session = await response.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("billy", session!.User.Username);
        Assert.InRange(session.ExpiresAtUtc, DateTime.UtcNow.AddDays(29), DateTime.UtcNow.AddDays(31));

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.Token);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Refresh_WithoutToken_Returns401()
    {
        var response = await _client.PostAsync("/api/auth/refresh", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_EndedSession_Returns401()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");
        var otherDevice = await _client.PostAsJsonAsync(
            "/api/auth/login", new { username = "billy", password = AutogratApiFactory.DefaultPassword });
        var otherSession = await otherDevice.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);
        await client.PutAsJsonAsync("/api/account/password",
            new { currentPassword = AutogratApiFactory.DefaultPassword, newPassword = "a-brand-new-password" });

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherSession!.Token);
        var response = await _client.PostAsync("/api/auth/refresh", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_KeepsTheLoginTime()
    {
        var client = await _factory.CreateAuthenticatedClientAsync("billy");
        var loginToken = client.DefaultRequestHeaders.Authorization!.Parameter!;

        var response = await client.PostAsync("/api/auth/refresh", null);
        var session = await response.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);

        Assert.Equal(GetAuthTime(loginToken), GetAuthTime(session!.Token));
    }

    [Fact]
    public async Task Refresh_NearTheMaximumSessionAge_ExpiresAtTheMaximum()
    {
        await _factory.CreateAuthenticatedClientAsync("billy");
        var authTimeUtc = DateTime.UtcNow.AddDays(-80);

        var response = await WithToken(await CreateTokenAsync("billy", authTimeUtc)).PostAsync("/api/auth/refresh", null);
        var session = await response.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.InRange(session!.ExpiresAtUtc,
            authTimeUtc.Add(TokenService.MaxSessionAge).AddMinutes(-1), authTimeUtc.Add(TokenService.MaxSessionAge).AddMinutes(1));
    }

    [Fact]
    public async Task Refresh_OlderThanTheMaximumSessionAge_Returns401()
    {
        await _factory.CreateAuthenticatedClientAsync("billy");
        var token = await CreateTokenAsync("billy", DateTime.UtcNow.Subtract(TokenService.MaxSessionAge).AddMinutes(-1));

        var response = await WithToken(token).PostAsync("/api/auth/refresh", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_TokenWithoutLoginTime_Returns401()
    {
        await _factory.CreateAuthenticatedClientAsync("billy");
        var client = WithToken(await CreateTokenAsync("billy", authTimeUtc: null));

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/auth/refresh", null)).StatusCode);
    }

    private static DateTime GetAuthTime(string token) =>
        DateTimeOffset.FromUnixTimeSeconds(long.Parse(new JsonWebToken(token).GetClaim(AuthClaims.AuthTime).Value)).UtcDateTime;

    private HttpClient WithToken(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>A token for an existing user, valid for an hour, with the given login time (or none, like older tokens).</summary>
    private async Task<string> CreateTokenAsync(string username, DateTime? authTimeUtc)
    {
        using var scope = _factory.Services.CreateScope();
        var user = await scope.ServiceProvider.GetRequiredService<AutogratDbContext>().Users.SingleAsync(u => u.Username == username);
        var claims = new List<Claim>
        {
            new(AuthClaims.UserId, user.Id.ToString()),
            new(AuthClaims.Username, user.Username),
            new(AuthClaims.SecurityStamp, user.SecurityStamp),
        };
        if (authTimeUtc is not null)
        {
            claims.Add(new(AuthClaims.AuthTime, EpochTime.GetIntDate(authTimeUtc.Value).ToString(), ClaimValueTypes.Integer64));
        }

        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = TokenService.Issuer,
            Audience = TokenService.Audience,
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(_factory.Services.GetRequiredService<JwtSigningKey>().Key, SecurityAlgorithms.HmacSha256),
        });
    }
}
