using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
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
        Assert.True(promoted!.IsAdmin);
    }

    [Fact]
    public async Task Promote_UnknownUser_Returns404()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var response = await admin.PostAsync("/api/admin/users/9999/promote", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
