using System.Net.Http.Headers;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;

namespace Autograt.Tests.Infrastructure;

/// <summary>
/// Hosts the API in-process against a throwaway SQLite file so tests never touch the real database.
/// </summary>
public class AutogratApiFactory : WebApplicationFactory<Program>
{
    public const string DefaultPassword = "correct-horse-battery";

    /// <summary>The API's clock; tests move it to write entries on other days.</summary>
    public TestClock Clock { get; } = new();

    private readonly string _databasePath =
        Path.Combine(Path.GetTempPath(), $"autograt-test-{Guid.NewGuid():N}.db");

    /// <summary>
    /// Registers a new user (unique name unless one is given), approves them if pending, logs in,
    /// and returns a client sending the token.
    /// </summary>
    public async Task<HttpClient> CreateAuthenticatedClientAsync(string? username = null)
    {
        username ??= $"user-{Guid.NewGuid():N}"[..20];
        var client = CreateClient();

        var register = await client.PostAsJsonAsync("/api/auth/register", new { username, password = DefaultPassword });
        register.EnsureSuccessStatusCode();
        var user = await register.Content.ReadFromJsonAsync<UserResponse>(TestJson.Options);
        if (user!.Role == UserRole.Pending)
        {
            await ApproveAsync(user.Id);
        }

        var login = await client.PostAsJsonAsync("/api/auth/login", new { username, password = DefaultPassword });
        login.EnsureSuccessStatusCode();
        var session = await login.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!.Token);
        return client;
    }

    private async Task ApproveAsync(int userId)
    {
        using var scope = Services.CreateScope();
        var result = await scope.ServiceProvider.GetRequiredService<UserService>().ApproveAsync(userId);
        if (result.IsSuccess == false)
        {
            throw new InvalidOperationException($"Could not approve user {userId}: {result.Error}.");
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={_databasePath}");
        builder.UseSetting("Jwt:Key", "test-signing-key-that-is-at-least-32-bytes-long");
        builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(Clock));
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        // Pooled connections keep the file locked on Windows until the pool is cleared.
        SqliteConnection.ClearAllPools();
        File.Delete(_databasePath);
    }
}
