using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

// A fresh factory (and database) per test, so the first registered user is always the admin.
public class AdminEndpointsTests : IDisposable
{
    private readonly AutogratApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task ListUsers_WithoutToken_Returns401()
    {
        var response = await _factory.CreateClient().GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ListUsers_AsAdmin_ReturnsAllUsers()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        await _factory.CreateAuthenticatedClientAsync("regular");

        var users = await admin.GetFromJsonAsync<List<UserResponse>>("/api/admin/users", TestJson.Options);

        Assert.Equal(["admin", "regular"], users!.Select(u => u.Username));
    }

    [Fact]
    public async Task Promote_AsNonAdmin_Returns403()
    {
        await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var regularUser = await regular.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);

        var response = await regular.PostAsync($"/api/admin/users/{regularUser!.Id}/promote", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Promote_AsAdmin_Returns204_AndUserBecomesAdmin()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var regularUser = await regular.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);

        var response = await admin.PostAsync($"/api/admin/users/{regularUser!.Id}/promote", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var promoted = await regular.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);
        Assert.Equal(UserRole.Admin, promoted!.Role);
    }

    [Fact]
    public async Task Promote_UnknownUser_Returns404()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var response = await admin.PostAsync("/api/admin/users/9999/promote", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Promote_PendingUser_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var pending = await RegisterPendingUserAsync("pending");

        var response = await admin.PostAsync($"/api/admin/users/{pending.Id}/promote", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Approve_AsAdmin_Returns204_AndUserCanLogIn()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var pending = await RegisterPendingUserAsync("pending");

        var response = await admin.PostAsync($"/api/admin/users/{pending.Id}/approve", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var login = await _factory.CreateClient().PostAsJsonAsync(
            "/api/auth/login", new { username = "pending", password = AutogratApiFactory.DefaultPassword });
        var session = await login.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);
        Assert.Equal(UserRole.Standard, session!.User.Role);
    }

    [Fact]
    public async Task Approve_AsNonAdmin_Returns403()
    {
        await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var pending = await RegisterPendingUserAsync("pending");

        var response = await regular.PostAsync($"/api/admin/users/{pending.Id}/approve", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Approve_UserNotPending_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var regularUser = await regular.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);

        var response = await admin.PostAsync($"/api/admin/users/{regularUser!.Id}/approve", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Approve_UnknownUser_Returns404()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var response = await admin.PostAsync("/api/admin/users/9999/approve", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<UserResponse> RegisterPendingUserAsync(string username)
    {
        var response = await _factory.CreateClient().PostAsJsonAsync(
            "/api/auth/register", new { username, password = AutogratApiFactory.DefaultPassword });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<UserResponse>(TestJson.Options))!;
    }
}
