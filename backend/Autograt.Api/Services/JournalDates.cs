namespace Autograt.Api.Services;

/// <summary>
/// Decides whether a date is past or future for a user. With the user's saved time zone, "today" is the date
/// there. Without one, the server can't know the user's date, so it allows any date that is today somewhere:
/// past means ended in the latest time zone (UTC−12) and future means not started in the earliest (UTC+14).
/// </summary>
public static class JournalDates
{
    private static readonly TimeSpan LatestUtcOffset = TimeSpan.FromHours(-12);
    private static readonly TimeSpan EarliestUtcOffset = TimeSpan.FromHours(14);

    /// <summary>True once the date has ended in the time zone, or everywhere on Earth without one.</summary>
    public static bool IsPast(DateOnly date, DateTimeOffset utcNow, TimeZoneInfo? timeZone) =>
        date < (timeZone is null ? DateIn(utcNow, LatestUtcOffset) : ToLocalDate(utcNow, timeZone));

    /// <summary>True while the date has not started in the time zone, or anywhere on Earth without one.</summary>
    public static bool IsFuture(DateOnly date, DateTimeOffset utcNow, TimeZoneInfo? timeZone) =>
        date > (timeZone is null ? DateIn(utcNow, EarliestUtcOffset) : ToLocalDate(utcNow, timeZone));

    /// <summary>The date at <paramref name="time"/> in the time zone, or in UTC without one.</summary>
    public static DateOnly ToLocalDate(DateTimeOffset time, TimeZoneInfo? timeZone) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(time, timeZone ?? TimeZoneInfo.Utc).DateTime);

    private static DateOnly DateIn(DateTimeOffset utcNow, TimeSpan offset) => DateOnly.FromDateTime(utcNow.ToOffset(offset).DateTime);
}
