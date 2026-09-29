using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>
/// Every minute, sends a reminder to each user whose reminder time has come, unless they have already rated
/// the day and written an entry. Each slot is handled once, even across restarts, via <see cref="User.LastReminderAtUtc"/>.
/// </summary>
public class ReminderService(IServiceScopeFactory scopeFactory, TimeProvider timeProvider, ILogger<ReminderService> logger)
    : BackgroundService
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TickInterval, timeProvider);
        do
        {
            try
            {
                await SendDueRemindersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Sending reminders failed.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>Handles the reminders due now for every user with reminders on and at least one subscribed browser.</summary>
    public async Task SendDueRemindersAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AutogratDbContext>();
        var pushService = scope.ServiceProvider.GetRequiredService<PushService>();
        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;

        var users = await db.Users
            .Where(u => db.UserSettings.Any(s =>
                s.UserId == u.Id && s.Setting == Setting.RemindersEnabled && s.Value == SettingDefinitions.On))
            .Where(u => db.PushSubscriptions.Any(p => p.UserId == u.Id))
            .ToListAsync(cancellationToken);

        var userIds = users.Select(u => u.Id).ToList();
        var settings = await db.UserSettings.AsNoTracking()
            .Where(s => userIds.Contains(s.UserId) && (s.Setting == Setting.ReminderTime || s.Setting == Setting.TimeZone))
            .OrderBy(s => s.Id)
            .ToListAsync(cancellationToken);

        foreach (var user in users)
        {
            try
            {
                await HandleUserAsync(db, pushService, user, settings.Where(s => s.UserId == user.Id).ToList(), nowUtc, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Sending a reminder to user {UserId} failed.", user.Id);
            }
        }
    }

    private async Task HandleUserAsync(
        AutogratDbContext db, PushService pushService, User user, List<UserSetting> settings, DateTime nowUtc, CancellationToken cancellationToken)
    {
        var timeZoneId = ValuesOf(settings, Setting.TimeZone)[0];
        if (TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId, out var timeZone) == false)
        {
            logger.LogWarning("User {UserId} has an unknown time zone '{TimeZone}'.", user.Id, timeZoneId);
            return;
        }

        var times = ValuesOf(settings, Setting.ReminderTime)
            .Select(value => SettingDefinitions.TryParseTime(value, out var time) ? time : (TimeOnly?)null)
            .OfType<TimeOnly>()
            .ToList();
        var slot = times.Count > 0 ? ReminderSchedule.GetDueSlot(nowUtc, timeZone, times, user.LastReminderAtUtc) : null;
        if (slot is null)
        {
            return;
        }

        if (await IsDayCompleteAsync(db, user.Id, slot.LocalDate, cancellationToken) == false)
        {
            var message = slot.IsLastOfDay && times.Count > 1 ? ReminderMessages.Evening : ReminderMessages.Daytime;
            await pushService.SendToUserAsync(user.Id, message, cancellationToken);
        }

        user.LastReminderAtUtc = slot.Utc;
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>A day needs no reminder once it has both a rating and at least one entry.</summary>
    private static Task<bool> IsDayCompleteAsync(AutogratDbContext db, int userId, DateOnly date, CancellationToken cancellationToken) =>
        db.JournalEntries.AnyAsync(
            e => e.UserId == userId && e.EntryDate == date && e.DayRating != null && e.SubEntries.Any(),
            cancellationToken);

    private static IReadOnlyList<string> ValuesOf(List<UserSetting> settings, Setting setting)
    {
        var saved = settings.Where(s => s.Setting == setting).Select(s => s.Value).ToList();
        return saved.Count > 0 ? saved : SettingDefinitions.For(setting).Defaults;
    }
}
