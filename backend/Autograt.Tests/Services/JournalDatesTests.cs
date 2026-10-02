using Autograt.Api.Services;

namespace Autograt.Tests.Services;

public class JournalDatesTests
{
    private static readonly TimeZoneInfo Toronto = TimeZoneInfo.FindSystemTimeZoneById("America/Toronto");
    private static readonly TimeZoneInfo Tokyo = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");
    private static readonly DateOnly Sept23 = new(2026, 9, 23);

    // 00:30 UTC on the 24th is 20:30 on the 23rd in Toronto (UTC−4) and 09:30 on the 24th in Tokyo (UTC+9).
    private static readonly DateTimeOffset Sept24At0030Utc = new(2026, 9, 24, 0, 30, 0, TimeSpan.Zero);

    [Fact]
    public void IsPast_InATimeZoneBehindUtc_FollowsTheLocalDate()
    {
        Assert.False(JournalDates.IsPast(Sept23, Sept24At0030Utc, Toronto));
        // 04:00 UTC on the 24th is midnight in Toronto.
        Assert.True(JournalDates.IsPast(Sept23, new DateTimeOffset(2026, 9, 24, 4, 0, 0, TimeSpan.Zero), Toronto));
    }

    [Fact]
    public void IsPast_InATimeZoneAheadOfUtc_FollowsTheLocalDate()
    {
        Assert.True(JournalDates.IsPast(Sept23, Sept24At0030Utc, Tokyo));
        Assert.False(JournalDates.IsPast(Sept23.AddDays(1), Sept24At0030Utc, Tokyo));
    }

    [Fact]
    public void IsPast_WithoutATimeZone_WaitsUntilTheDateHasEndedEverywhere()
    {
        Assert.False(JournalDates.IsPast(Sept23, new DateTimeOffset(2026, 9, 24, 11, 59, 0, TimeSpan.Zero), null));
        Assert.True(JournalDates.IsPast(Sept23, new DateTimeOffset(2026, 9, 24, 12, 0, 0, TimeSpan.Zero), null));
    }

    [Fact]
    public void IsFuture_InATimeZone_FollowsTheLocalDate()
    {
        Assert.True(JournalDates.IsFuture(Sept23.AddDays(1), Sept24At0030Utc, Toronto));
        Assert.False(JournalDates.IsFuture(Sept23.AddDays(1), Sept24At0030Utc, Tokyo));
        Assert.True(JournalDates.IsFuture(Sept23.AddDays(2), Sept24At0030Utc, Tokyo));
    }

    [Fact]
    public void IsFuture_WithoutATimeZone_WaitsUntilTheDateHasStartedAnywhere()
    {
        // 09:59 UTC on the 23rd is 23:59 on the 23rd in UTC+14.
        Assert.True(JournalDates.IsFuture(Sept23.AddDays(1), new DateTimeOffset(2026, 9, 23, 9, 59, 0, TimeSpan.Zero), null));
        Assert.False(JournalDates.IsFuture(Sept23.AddDays(1), new DateTimeOffset(2026, 9, 23, 10, 0, 0, TimeSpan.Zero), null));
    }

    [Fact]
    public void ToLocalDate_UsesTheTimeZone_OrUtcWithoutOne()
    {
        Assert.Equal(Sept23, JournalDates.ToLocalDate(Sept24At0030Utc, Toronto));
        Assert.Equal(Sept23.AddDays(1), JournalDates.ToLocalDate(Sept24At0030Utc, null));
    }
}
