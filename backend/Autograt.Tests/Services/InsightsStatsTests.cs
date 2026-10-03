using Autograt.Api.Contracts;
using Autograt.Api.Services;

namespace Autograt.Tests.Services;

public class InsightsStatsTests
{
    private static readonly DateOnly Today = new(2026, 9, 23);

    [Fact]
    public void GetStreaks_NoDays_ReturnsZeroAndNoLongest()
    {
        var streaks = InsightsStats.GetStreaks([], Today);

        Assert.Equal(new Streaks(0, null), streaks);
    }

    [Fact]
    public void GetStreaks_RunEndingToday_IsCurrent()
    {
        var streaks = InsightsStats.GetStreaks(DaysAgo(0, 1, 2), Today);

        Assert.Equal(3, streaks.Current);
    }

    [Fact]
    public void GetStreaks_TodayNotJournaled_CurrentEndsYesterday()
    {
        var streaks = InsightsStats.GetStreaks(DaysAgo(1, 2), Today);

        Assert.Equal(2, streaks.Current);
    }

    [Fact]
    public void GetStreaks_NeitherTodayNorYesterdayJournaled_CurrentIsZero()
    {
        var streaks = InsightsStats.GetStreaks(DaysAgo(2, 3), Today);

        Assert.Equal(0, streaks.Current);
    }

    [Fact]
    public void GetStreaks_GapBreaksTheCurrentStreak()
    {
        var streaks = InsightsStats.GetStreaks(DaysAgo(0, 1, 3, 4, 5), Today);

        Assert.Equal(2, streaks.Current);
    }

    [Fact]
    public void GetStreaks_Longest_IsTheLongestRunWithItsDates()
    {
        var streaks = InsightsStats.GetStreaks(DaysAgo(0, 5, 6, 7, 10, 11), Today);

        Assert.Equal(new StreakRun(3, Today.AddDays(-7), Today.AddDays(-5)), streaks.Longest);
    }

    [Fact]
    public void GetStreaks_TiedLongestRuns_PicksTheMostRecent()
    {
        var streaks = InsightsStats.GetStreaks(DaysAgo(3, 4, 7, 8), Today);

        Assert.Equal(new StreakRun(2, Today.AddDays(-4), Today.AddDays(-3)), streaks.Longest);
    }

    [Fact]
    public void GetStreaks_UnorderedDays_AreSortedFirst()
    {
        var streaks = InsightsStats.GetStreaks(DaysAgo(2, 0, 1), Today);

        Assert.Equal((3, new StreakRun(3, Today.AddDays(-2), Today)), (streaks.Current, streaks.Longest));
    }

    [Fact]
    public void GetAverage_IgnoresUnratedDays()
    {
        var average = InsightsStats.GetAverage([4, null, 7, null]);

        Assert.Equal(new RatingAverage(5.5, 2), average);
    }

    [Fact]
    public void GetAverage_NoRatedDays_ReturnsNull()
    {
        var average = InsightsStats.GetAverage([null]);

        Assert.Equal(new RatingAverage(null, 0), average);
    }

    private static DateOnly[] DaysAgo(params int[] days) => days.Select(d => Today.AddDays(-d)).ToArray();
}
