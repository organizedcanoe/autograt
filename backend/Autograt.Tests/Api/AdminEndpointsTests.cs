using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
    public async Task ListUsers_AsNonAdmin_Returns403()
    {
        await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");

        var response = await regular.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
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

    [Fact]
    public async Task Delete_PendingUser_Returns204_AndUserIsGone()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var pending = await RegisterPendingUserAsync("pending");

        var response = await admin.DeleteAsync($"/api/admin/users/{pending.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var users = await admin.GetFromJsonAsync<List<UserResponse>>("/api/admin/users", TestJson.Options);
        Assert.Equal(["admin"], users!.Select(u => u.Username));
    }

    [Fact]
    public async Task Delete_AsNonAdmin_Returns403()
    {
        await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var pending = await RegisterPendingUserAsync("pending");

        var response = await regular.DeleteAsync($"/api/admin/users/{pending.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Delete_StandardUser_Returns204_RemovesTheirData_AndEndsTheirSession()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var regularUser = await regular.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);
        await regular.PutAsJsonAsync("/api/settings/BrightnessTheme", new { values = new[] { "dark" } });

        var response = await admin.DeleteAsync($"/api/admin/users/{regularUser!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await regular.GetAsync("/api/auth/me")).StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AutogratDbContext>();
        Assert.False(await db.UserSettings.AnyAsync(s => s.UserId == regularUser.Id));
    }

    [Fact]
    public async Task Delete_DisabledUser_Returns204()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regularUser = await CreateStandardUserAsync("regular");
        await admin.PostAsync($"/api/admin/users/{regularUser.Id}/disable", null);

        var response = await admin.DeleteAsync($"/api/admin/users/{regularUser.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Delete_Admin_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var otherAdmin = await CreateAdminAsync(admin, "other");

        var response = await admin.DeleteAsync($"/api/admin/users/{otherAdmin.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Delete_UnknownUser_Returns404()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var response = await admin.DeleteAsync("/api/admin/users/9999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Promote_TakesEffectOnTheUsersExistingSession()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var regularUser = await regular.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);

        await admin.PostAsync($"/api/admin/users/{regularUser!.Id}/promote", null);

        Assert.Equal(HttpStatusCode.OK, (await regular.GetAsync("/api/admin/users")).StatusCode);
    }

    [Fact]
    public async Task Demote_Admin_Returns204_AndRemovesAdminRightsFromTheirExistingSession()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var other = await _factory.CreateAuthenticatedClientAsync("other");
        var otherUser = await other.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);
        await admin.PostAsync($"/api/admin/users/{otherUser!.Id}/promote", null);

        var response = await admin.PostAsync($"/api/admin/users/{otherUser.Id}/demote", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.GetAsync("/api/admin/users")).StatusCode);
        var demoted = await other.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);
        Assert.Equal(UserRole.Standard, demoted!.Role);
    }

    [Fact]
    public async Task Demote_Self_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var adminUser = await admin.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);
        await CreateAdminAsync(admin, "other");

        var response = await admin.PostAsync($"/api/admin/users/{adminUser!.Id}/demote", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Demote_UserNotAdmin_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regularUser = await CreateStandardUserAsync("regular");

        var response = await admin.PostAsync($"/api/admin/users/{regularUser.Id}/demote", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Disable_StandardUser_Returns204_EndsTheirSession_AndBlocksLogin()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var regularUser = await regular.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);

        var response = await admin.PostAsync($"/api/admin/users/{regularUser!.Id}/disable", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await regular.GetAsync("/api/auth/me")).StatusCode);
        var login = await _factory.CreateClient().PostAsJsonAsync(
            "/api/auth/login", new { username = "regular", password = AutogratApiFactory.DefaultPassword });
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
    }

    [Fact]
    public async Task Disable_Admin_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var otherAdmin = await CreateAdminAsync(admin, "other");

        var response = await admin.PostAsync($"/api/admin/users/{otherAdmin.Id}/disable", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Enable_DisabledUser_Returns204_AndUserCanLogIn()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regularUser = await CreateStandardUserAsync("regular");
        await admin.PostAsync($"/api/admin/users/{regularUser.Id}/disable", null);

        var response = await admin.PostAsync($"/api/admin/users/{regularUser.Id}/enable", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var session = await LogInAsync("regular", AutogratApiFactory.DefaultPassword);
        Assert.Equal(UserRole.Standard, session.User.Role);
    }

    [Fact]
    public async Task Enable_UserNotDisabled_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regularUser = await CreateStandardUserAsync("regular");

        var response = await admin.PostAsync($"/api/admin/users/{regularUser.Id}/enable", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("demote")]
    [InlineData("disable")]
    [InlineData("enable")]
    public async Task RoleChange_UnknownUser_Returns404(string action)
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var response = await admin.PostAsync($"/api/admin/users/9999/{action}", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("demote")]
    [InlineData("disable")]
    [InlineData("enable")]
    public async Task RoleChange_AsNonAdmin_Returns403(string action)
    {
        await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var other = await CreateStandardUserAsync("other");

        var response = await regular.PostAsync($"/api/admin/users/{other.Id}/{action}", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Settings_DefaultToOpenRegistration()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var settings = await admin.GetFromJsonAsync<AppSettingsResponse>("/api/admin/settings", TestJson.Options);

        Assert.True(settings!.RegistrationOpen);
        var status = await _factory.CreateClient().GetFromJsonAsync<RegistrationStatusResponse>(
            "/api/auth/registration", TestJson.Options);
        Assert.True(status!.Open);
    }

    [Fact]
    public async Task Settings_ClosingRegistration_RejectsNewSignUps()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var response = await admin.PutAsJsonAsync("/api/admin/settings", new { registrationOpen = false });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var settings = await response.Content.ReadFromJsonAsync<AppSettingsResponse>(TestJson.Options);
        Assert.False(settings!.RegistrationOpen);
        var status = await _factory.CreateClient().GetFromJsonAsync<RegistrationStatusResponse>(
            "/api/auth/registration", TestJson.Options);
        Assert.False(status!.Open);
        var register = await _factory.CreateClient().PostAsJsonAsync(
            "/api/auth/register", new { username = "newcomer", password = AutogratApiFactory.DefaultPassword });
        Assert.Equal(HttpStatusCode.Forbidden, register.StatusCode);
    }

    [Fact]
    public async Task Settings_ReopeningRegistration_AllowsSignUps()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        await admin.PutAsJsonAsync("/api/admin/settings", new { registrationOpen = false });

        await admin.PutAsJsonAsync("/api/admin/settings", new { registrationOpen = true });

        var register = await _factory.CreateClient().PostAsJsonAsync(
            "/api/auth/register", new { username = "newcomer", password = AutogratApiFactory.DefaultPassword });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
    }

    [Fact]
    public async Task Settings_AsNonAdmin_Returns403()
    {
        await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");

        Assert.Equal(HttpStatusCode.Forbidden, (await regular.GetAsync("/api/admin/settings")).StatusCode);
        var update = await regular.PutAsJsonAsync("/api/admin/settings", new { registrationOpen = false });
        Assert.Equal(HttpStatusCode.Forbidden, update.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_ReturnsTemporaryPassword_ThatLogsInAndMustBeChanged()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regularUser = await CreateStandardUserAsync("regular");

        var response = await admin.PostAsync($"/api/admin/users/{regularUser.Id}/reset-password", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reset = await response.Content.ReadFromJsonAsync<ResetPasswordResponse>(TestJson.Options);
        Assert.False(string.IsNullOrWhiteSpace(reset!.TemporaryPassword));
        var session = await LogInAsync("regular", reset.TemporaryPassword);
        Assert.True(session.User.MustChangePassword);
        var oldLogin = await _factory.CreateClient().PostAsJsonAsync(
            "/api/auth/login", new { username = "regular", password = AutogratApiFactory.DefaultPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_EndsTheUsersSessions()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var regularUser = await regular.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);

        await admin.PostAsync($"/api/admin/users/{regularUser!.Id}/reset-password", null);

        Assert.Equal(HttpStatusCode.Unauthorized, (await regular.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ResetPassword_ThenChangingPassword_ClearsMustChangePassword()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var regularUser = await CreateStandardUserAsync("regular");
        var reset = await (await admin.PostAsync($"/api/admin/users/{regularUser.Id}/reset-password", null))
            .Content.ReadFromJsonAsync<ResetPasswordResponse>(TestJson.Options);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", (await LogInAsync("regular", reset!.TemporaryPassword)).Token);

        var change = await client.PutAsJsonAsync("/api/account/password",
            new { currentPassword = reset.TemporaryPassword, newPassword = "my-own-new-password" });

        var session = await change.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);
        Assert.False(session!.User.MustChangePassword);
        Assert.False((await LogInAsync("regular", "my-own-new-password")).User.MustChangePassword);
    }

    [Fact]
    public async Task ResetPassword_AnotherAdmin_Returns200()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var otherAdmin = await CreateStandardUserAsync("other");
        await admin.PostAsync($"/api/admin/users/{otherAdmin.Id}/promote", null);

        var response = await admin.PostAsync($"/api/admin/users/{otherAdmin.Id}/reset-password", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_PendingUser_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var pending = await RegisterPendingUserAsync("pending");

        var response = await admin.PostAsync($"/api/admin/users/{pending.Id}/reset-password", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_Self_Returns400()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");
        var adminUser = await admin.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options);

        var response = await admin.PostAsync($"/api/admin/users/{adminUser!.Id}/reset-password", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_UnknownUser_Returns404()
    {
        var admin = await _factory.CreateAuthenticatedClientAsync("admin");

        var response = await admin.PostAsync("/api/admin/users/9999/reset-password", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_AsNonAdmin_Returns403()
    {
        await _factory.CreateAuthenticatedClientAsync("admin");
        var regular = await _factory.CreateAuthenticatedClientAsync("regular");
        var other = await CreateStandardUserAsync("other");

        var response = await regular.PostAsync($"/api/admin/users/{other.Id}/reset-password", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<UserResponse> CreateAdminAsync(HttpClient admin, string username)
    {
        var user = await CreateStandardUserAsync(username);
        (await admin.PostAsync($"/api/admin/users/{user.Id}/promote", null)).EnsureSuccessStatusCode();
        return user;
    }

    private async Task<UserResponse> CreateStandardUserAsync(string username)
    {
        var client = await _factory.CreateAuthenticatedClientAsync(username);
        return (await client.GetFromJsonAsync<UserResponse>("/api/auth/me", TestJson.Options))!;
    }

    private async Task<LoginResponse> LogInAsync(string username, string password)
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { username, password });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options))!;
    }

    private async Task<UserResponse> RegisterPendingUserAsync(string username)
    {
        var response = await _factory.CreateClient().PostAsJsonAsync(
            "/api/auth/register", new { username, password = AutogratApiFactory.DefaultPassword });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<UserResponse>(TestJson.Options))!;
    }
}
