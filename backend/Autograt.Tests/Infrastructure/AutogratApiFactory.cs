using System.Net.Http.Headers;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Api.RateLimiting;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WebPush;

namespace Autograt.Tests.Infrastructure;

/// <summary>
/// Hosts the API in-process against a throwaway SQLite file so tests never touch the real database.
/// </summary>
public class AutogratApiFactory : WebApplicationFactory<Program>
{
    public const string DefaultPassword = "correct-horse-battery";

    /// <summary>The API's rate limits; by default high enough that tests never reach them.</summary>
    public RateLimitingOptions RateLimits { get; init; } = new()
    {
        AuthPermitsPerMinute = 10_000,
        AnonymousPermitsPerMinute = 10_000,
        UserPermitsPerMinute = 10_000,
    };

    /// <summary>The API's clock; tests move it to write entries on other days.</summary>
    public TestClock Clock { get; } = new();

    /// <summary>Records push notifications instead of sending them.</summary>
    public FakePushSender Push { get; } = new();

    // Generated once so tests never write a vapid.json into the temp directory.
    private static readonly VapidDetails VapidKeys = VapidHelper.GenerateVapidKeys();

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
        builder.UseSetting($"{RateLimitingOptions.SectionName}:{nameof(RateLimitingOptions.AuthPermitsPerMinute)}", $"{RateLimits.AuthPermitsPerMinute}");
        builder.UseSetting($"{RateLimitingOptions.SectionName}:{nameof(RateLimitingOptions.AnonymousPermitsPerMinute)}", $"{RateLimits.AnonymousPermitsPerMinute}");
        builder.UseSetting($"{RateLimitingOptions.SectionName}:{nameof(RateLimitingOptions.UserPermitsPerMinute)}", $"{RateLimits.UserPermitsPerMinute}");
        builder.UseSetting($"{PushOptions.SectionName}:{nameof(PushOptions.VapidPublicKey)}", VapidKeys.PublicKey);
        builder.UseSetting($"{PushOptions.SectionName}:{nameof(PushOptions.VapidPrivateKey)}", VapidKeys.PrivateKey);
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<TimeProvider>(Clock);
            services.AddSingleton<IPushSender>(Push);

            // Tests run reminders on demand (see ReminderServiceTests) rather than on the background timer.
            services.Remove(services.Single(d =>
                d.ServiceType == typeof(IHostedService) && d.ImplementationType == typeof(ReminderService)));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        // Pooled connections keep the file locked on Windows until the pool is cleared.
        SqliteConnection.ClearAllPools();
        File.Delete(_databasePath);
    }
}
