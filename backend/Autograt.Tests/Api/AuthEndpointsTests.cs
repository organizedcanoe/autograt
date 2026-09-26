using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;

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
}
