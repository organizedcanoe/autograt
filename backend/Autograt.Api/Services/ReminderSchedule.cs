namespace Autograt.Api.Services;

/// <summary>A reminder time on a particular day.</summary>
/// <param name="Utc">When the reminder is due.</param>
/// <param name="LocalDate">The user's day the reminder is for.</param>
/// <param name="IsLastOfDay">Whether this is the user's latest reminder time.</param>
public sealed record ReminderSlot(DateTime Utc, DateOnly LocalDate, bool IsLastOfDay);

/// <summary>Works out which reminder, if any, is due for a user right now.</summary>
public static class ReminderSchedule
{
    /// <summary>How late a reminder may still be sent, e.g. after a restart; older ones are dropped.</summary>
    public static readonly TimeSpan GraceWindow = TimeSpan.FromMinutes(15);

    /// <summary>
    /// Returns the latest reminder slot that is due at <paramref name="nowUtc"/> and within the grace window,
    /// or null if there is none or it was already handled (it is not after <paramref name="lastSentUtc"/>).
    /// </summary>
    /// <param name="times">The user's local reminder times, in any order.</param>
    public static ReminderSlot? GetDueSlot(DateTime nowUtc, TimeZoneInfo timeZone, IReadOnlyList<TimeOnly> times, DateTime? lastSentUtc)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(nowUtc, timeZone));
        var lastTime = times.Max();

        // Yesterday too, so a reminder just before midnight can still be sent just after it.
        var latestDue = new[] { today.AddDays(-1), today }
            .SelectMany(date => times.Select(time => new ReminderSlot(ToUtc(date, time, timeZone), date, time == lastTime)))
            .Where(slot => slot.Utc <= nowUtc && nowUtc - slot.Utc <= GraceWindow)
            .MaxBy(slot => slot.Utc);

        return latestDue is not null && (lastSentUtc is null || latestDue.Utc > lastSentUtc) ? latestDue : null;
    }

    private static DateTime ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo timeZone)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);

        // Skipped when clocks go forward: send when the clock jumps past it, using the offset from before the jump.
        if (timeZone.IsInvalidTime(local))
        {
            return DateTime.SpecifyKind(local - timeZone.GetUtcOffset(local.AddDays(-1)), DateTimeKind.Utc);
        }

        // Repeated when clocks go back: use the first occurrence, which has the larger offset.
        if (timeZone.IsAmbiguousTime(local))
        {
            return DateTime.SpecifyKind(local - timeZone.GetAmbiguousTimeOffsets(local).Max(), DateTimeKind.Utc);
        }

        return TimeZoneInfo.ConvertTimeToUtc(local, timeZone);
    }
}
