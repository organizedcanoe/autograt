using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Autograt.Api.Services;
using Autograt.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Autograt.Tests.Services;

/// <summary>Runs single reminder ticks against the API's database, with a fake push sender and the test clock.</summary>
public class ReminderServiceTests : IClassFixture<AutogratApiFactory>
{
    private static readonly DateOnly Today = TestClock.DefaultToday;
    private static readonly Streaks NoStreak = new(0, null);

    private readonly AutogratApiFactory _factory;
    private readonly ReminderService _reminders;

    public ReminderServiceTests(AutogratApiFactory factory)
    {
        _factory = factory;
        _reminders = CreateReminders(new FakeRandom());
    }

    [Fact]
    public async Task DueSlot_SendsToEveryDeviceOfTheUser()
    {
        var (_, phone) = await CreateUserWithRemindersAsync();
        var laptop = NewEndpoint();
        await SubscribeAsync(phone.Client, laptop);

        await RunAtAsync(12, 0);

        var expected = ReminderMessages.For(new TimeOnly(12, 0), hasEntries: false, hasRating: false, NoStreak, new FakeRandom());
        Assert.Equal([expected!], _factory.Push.SentTo(phone.Endpoint));
        Assert.Equal([expected!], _factory.Push.SentTo(laptop));
    }

    [Fact]
    public async Task LaterTicks_DoNotResendTheSameSlot()
    {
        var (_, device) = await CreateUserWithRemindersAsync();

        await RunAtAsync(12, 0);
        await RunAtAsync(12, 1);
        await RunAtAsync(12, 14);

        Assert.Single(_factory.Push.SentTo(device.Endpoint));
    }

    [Fact]
    public async Task EveningSlot_UsesTheEveningMessage()
    {
        var (_, device) = await CreateUserWithRemindersAsync();

        await RunAtAsync(20, 3);

        var expected = ReminderMessages.For(new TimeOnly(20, 0), hasEntries: false, hasRating: false, NoStreak, new FakeRandom());
        Assert.Equal([expected!], _factory.Push.SentTo(device.Endpoint));
    }

    [Fact]
    public async Task RemindersOff_SendsNothing()
    {
        var (_, device) = await CreateUserWithRemindersAsync(remindersEnabled: false);

        await RunAtAsync(12, 0);

        Assert.Empty(_factory.Push.SentTo(device.Endpoint));
    }

    [Fact]
    public async Task DisabledUser_SendsNothing()
    {
        var (username, device) = await CreateUserWithRemindersAsync();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AutogratDbContext>();
            await db.Users.Where(u => u.Username == username)
                .ExecuteUpdateAsync(u => u.SetProperty(x => x.Role, UserRole.Disabled));
        }

        await RunAtAsync(12, 0);

        Assert.Empty(_factory.Push.SentTo(device.Endpoint));
    }

    [Fact]
    public async Task NoSubscriptions_SkipsTheUser()
    {
        var username = NewUsername();
        var client = await _factory.CreateAuthenticatedClientAsync(username);
        await client.SaveSettingAsync("RemindersEnabled", "on");

        await RunAtAsync(12, 0);

        Assert.Null(await GetLastReminderAtUtcAsync(username));
    }

    [Fact]
    public async Task UsesTheUsersTimeZone()
    {
        var (_, device) = await CreateUserWithRemindersAsync();
        await device.Client.SaveSettingAsync("TimeZone", "America/Toronto");

        await RunAtAsync(12, 0);
        Assert.Empty(_factory.Push.SentTo(device.Endpoint));

        await RunAtAsync(16, 0); // Noon in Toronto (UTC−4).
        Assert.Single(_factory.Push.SentTo(device.Endpoint));
    }

    [Fact]
    public async Task DayWithEntriesAndARating_IsSkipped()
    {
        var (username, device) = await CreateUserWithRemindersAsync();
        await device.Client.AddSubEntryAsync(Today, "Good", "Went for a run");
        await device.Client.RateDayAsync(Today, 8);

        await RunAtAsync(12, 0);

        Assert.Empty(_factory.Push.SentTo(device.Endpoint));
        Assert.NotNull(await GetLastReminderAtUtcAsync(username));
    }

    [Fact]
    public async Task DayWithEntriesButNoRating_IsStillReminded()
    {
        var (_, device) = await CreateUserWithRemindersAsync();
        await device.Client.AddSubEntryAsync(Today, "Good", "Went for a run");

        await RunAtAsync(12, 0);

        var message = Assert.Single(_factory.Push.SentTo(device.Endpoint));
        Assert.EndsWith("rate it.", message.Body);
    }

    [Fact]
    public async Task DayWithARatingButNoEntries_IsStillReminded()
    {
        var (_, device) = await CreateUserWithRemindersAsync();
        await device.Client.RateDayAsync(Today, 5);

        await RunAtAsync(12, 0);

        var message = Assert.Single(_factory.Push.SentTo(device.Endpoint));
        Assert.EndsWith("add an entry.", message.Body);
    }

    [Fact]
    public async Task CurrentStreak_IsMentioned()
    {
        var (_, device) = await CreateUserWithRemindersAsync();
        // Past days are read-only, so each is journaled on its own day.
        using (_factory.Clock.TravelTo(Today.AddDays(-2)))
        {
            await device.Client.AddSubEntryAsync(Today.AddDays(-2), "Good", "Went for a run");
        }

        using (_factory.Clock.TravelTo(Today.AddDays(-1)))
        {
            await device.Client.RateDayAsync(Today.AddDays(-1), 7);
        }

        await RunAtAsync(12, 0, CreateReminders(new FakeRandom(0)));

        var message = Assert.Single(_factory.Push.SentTo(device.Endpoint));
        Assert.Equal("Journal today for your longest streak yet: 3 days.", message.Body);
    }

    [Fact]
    public async Task ExpiredSubscription_IsDeleted()
    {
        var (_, device) = await CreateUserWithRemindersAsync();
        _factory.Push.GoneEndpoints[device.Endpoint] = true;

        await RunAtAsync(12, 0);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AutogratDbContext>();
        Assert.False(await db.PushSubscriptions.AnyAsync(s => s.Endpoint == device.Endpoint));
    }

    private ReminderService CreateReminders(Random random) => new(
        _factory.Services.GetRequiredService<IServiceScopeFactory>(), _factory.Clock, random, NullLogger<ReminderService>.Instance);

    private async Task RunAtAsync(int hour, int minute, ReminderService? reminders = null)
    {
        using var _ = _factory.Clock.TravelTo(new DateTimeOffset(Today.ToDateTime(new TimeOnly(hour, minute)), TimeSpan.Zero));
        await (reminders ?? _reminders).SendDueRemindersAsync(CancellationToken.None);
    }

    private async Task<(string Username, Device Device)> CreateUserWithRemindersAsync(bool remindersEnabled = true)
    {
        var username = NewUsername();
        var client = await _factory.CreateAuthenticatedClientAsync(username);
        if (remindersEnabled)
        {
            await client.SaveSettingAsync("RemindersEnabled", "on");
        }

        var endpoint = NewEndpoint();
        await SubscribeAsync(client, endpoint);
        return (username, new Device(client, endpoint));
    }

    private async Task<DateTime?> GetLastReminderAtUtcAsync(string username)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AutogratDbContext>();
        return await db.Users.Where(u => u.Username == username).Select(u => u.LastReminderAtUtc).SingleAsync();
    }

    private static async Task SubscribeAsync(HttpClient client, string endpoint)
    {
        var response = await client.PostAsJsonAsync(
            "/api/push/subscriptions", new { endpoint, keys = new { p256dh = "p256dh-key", auth = "auth-secret" } });
        response.EnsureSuccessStatusCode();
    }

    private static string NewUsername() => $"user-{Guid.NewGuid():N}"[..20];

    private static string NewEndpoint() => $"https://push.example.com/{Guid.NewGuid():N}";

    private sealed record Device(HttpClient Client, string Endpoint);
}
