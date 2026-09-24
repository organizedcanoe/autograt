using System.Net.Http.Headers;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
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
    /// Registers a new user (unique name unless one is given), logs in, and returns a client sending the token.
    /// </summary>
    public async Task<HttpClient> CreateAuthenticatedClientAsync(string? username = null)
    {
        username ??= $"user-{Guid.NewGuid():N}"[..20];
        var client = CreateClient();

        var register = await client.PostAsJsonAsync("/api/auth/register", new { username, password = DefaultPassword });
        register.EnsureSuccessStatusCode();

        var login = await client.PostAsJsonAsync("/api/auth/login", new { username, password = DefaultPassword });
        login.EnsureSuccessStatusCode();
        var session = await login.Content.ReadFromJsonAsync<LoginResponse>(TestJson.Options);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!.Token);
        return client;
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
