using Autograt.Api.Data;
using Autograt.Api.Models;
using Autograt.Api.Services;
using Autograt.Tests.Infrastructure;
using Microsoft.AspNetCore.Identity;

namespace Autograt.Tests.Services;

public class AuthServiceTests : IDisposable
{
    private readonly SqliteTestDatabase _database = new();

    public void Dispose() => _database.Dispose();

    [Fact]
    public async Task Register_FirstUserIsAdmin_LaterUsersAreNot()
    {
        var first = await RegisterAsync("first", "password-one");
        var second = await RegisterAsync("second", "password-two");

        Assert.True(first.Value!.IsAdmin);
        Assert.False(second.Value!.IsAdmin);
    }

    [Fact]
    public async Task Register_StoresHashNotPlainPassword()
    {
        var result = await RegisterAsync("billy", "my-secret-password");

        Assert.NotEqual("my-secret-password", result.Value!.PasswordHash);
        Assert.DoesNotContain("my-secret-password", result.Value.PasswordHash);
    }

    [Fact]
    public async Task Register_TrimsUsername()
    {
        var result = await RegisterAsync("  billy  ", "password-one");

        Assert.Equal("billy", result.Value!.Username);
    }

    [Theory]
    [InlineData("billy")]
    [InlineData("BILLY")]
    public async Task Register_DuplicateUsername_IsConflict(string duplicate)
    {
        await RegisterAsync("billy", "password-one");

        var result = await RegisterAsync(duplicate, "password-two");

        Assert.True(result.IsConflict);
    }

    [Fact]
    public async Task ValidateCredentials_CorrectPassword_ReturnsUser()
    {
        await RegisterAsync("billy", "my-secret-password");

        await using var context = _database.CreateContext();
        var user = await CreateService(context).ValidateCredentialsAsync("Billy", "my-secret-password");

        Assert.Equal("billy", user?.Username);
    }

    [Theory]
    [InlineData("billy", "wrong-password")]
    [InlineData("nobody", "my-secret-password")]
    public async Task ValidateCredentials_WrongUserOrPassword_ReturnsNull(string username, string password)
    {
        await RegisterAsync("billy", "my-secret-password");

        await using var context = _database.CreateContext();
        var user = await CreateService(context).ValidateCredentialsAsync(username, password);

        Assert.Null(user);
    }

    private async Task<ServiceResult<User>> RegisterAsync(string username, string password)
    {
        await using var context = _database.CreateContext();
        return await CreateService(context).RegisterAsync(username, password);
    }

    private static AuthService CreateService(AutogratDbContext context) =>
        new(context, new PasswordHasher<User>());
}
