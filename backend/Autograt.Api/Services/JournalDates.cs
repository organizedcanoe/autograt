namespace Autograt.Api.Services;

/// <summary>
/// Decides whether a date is past or future without knowing the user's time zone, by comparing it with the
/// date in the latest (UTC−12) and earliest (UTC+14) time zones.
/// </summary>
public static class JournalDates
{
    private static readonly TimeSpan LatestUtcOffset = TimeSpan.FromHours(-12);
    private static readonly TimeSpan EarliestUtcOffset = TimeSpan.FromHours(14);

    /// <summary>True once the date has ended everywhere on Earth. Clients apply the stricter rule for their own local date.</summary>
    public static bool IsPast(DateOnly date, DateTimeOffset utcNow) => date < DateIn(utcNow, LatestUtcOffset);

    /// <summary>True while the date has not started anywhere on Earth.</summary>
    public static bool IsFuture(DateOnly date, DateTimeOffset utcNow) => date > DateIn(utcNow, EarliestUtcOffset);

    private static DateOnly DateIn(DateTimeOffset utcNow, TimeSpan offset) => DateOnly.FromDateTime(utcNow.ToOffset(offset).DateTime);
}
