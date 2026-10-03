using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

public class InsightsEndpointTests(AutogratApiFactory factory) : IClassFixture<AutogratApiFactory>
{
    private static readonly DateOnly Today = TestClock.DefaultToday;

    [Fact]
    public async Task Insights_WithoutToken_Returns401()
    {
        var response = await factory.CreateClient().GetAsync("/api/insights");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Insights_NoData_ReturnsZerosAndNulls()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var insights = await GetInsightsAsync(client);

        Assert.Equal(Today, insights.Today);
        var empty = new RatingAverage(null, 0);
        Assert.Equal(new RatingAverages(empty, empty, empty), insights.Ratings);
        Assert.Equal(new CategoryCounts(0, 0, 0), insights.Categories);
        Assert.Equal(new Streaks(0, null), insights.Streaks);
    }

    [Fact]
    public async Task Insights_Averages_IgnoreUnratedDaysAndUseWindowsEndingToday()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await RateAsync(client, Today, 8);
        await RateAsync(client, Today.AddDays(-6), 6);
        await AddAsync(client, Today.AddDays(-3), "Good");
        await RateAsync(client, Today.AddDays(-7), 4);
        await RateAsync(client, Today.AddDays(-29), 2);
        await RateAsync(client, Today.AddDays(-30), 0);

        var ratings = (await GetInsightsAsync(client)).Ratings;

        Assert.Equal(new RatingAverage(7, 2), ratings.Last7Days);
        Assert.Equal(new RatingAverage(5, 4), ratings.Last30Days);
        Assert.Equal(new RatingAverage(4, 5), ratings.AllTime);
    }

    [Fact]
    public async Task Insights_CategoryCounts_ExcludeAppendsAndOtherUsers()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var stranger = await factory.CreateAuthenticatedClientAsync();
        var good = await AddAsync(client, Today, "Good");
        await AddAsync(client, Today, "Good");
        await AddAsync(client, Today.AddDays(-1), "Bad");
        await AddAsync(client, Today.AddDays(-1), "Neutral");
        await AddAsync(stranger, Today, "Bad");
        await client.PostAsJsonAsync($"/api/journal/sub-entries/{good.Id}/appends", new { content = "Later note" });

        var insights = await GetInsightsAsync(client);

        Assert.Equal(new CategoryCounts(2, 1, 1), insights.Categories);
    }

    [Fact]
    public async Task Insights_Streaks_CountJournaledDaysOnly()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await AddAsync(client, Today.AddDays(-1), "Good");
        await RateAsync(client, Today.AddDays(-2), 5);
        await AddAsync(client, Today.AddDays(-5), "Good");
        await AddAsync(client, Today.AddDays(-6), "Good");
        await AddAsync(client, Today.AddDays(-7), "Good");

        // A day whose only sub-entry was deleted, and which was never rated, isn't journaled.
        var deleted = await AddAsync(client, Today, "Good");
        (await client.DeleteAsync($"/api/journal/sub-entries/{deleted.Id}")).EnsureSuccessStatusCode();

        var streaks = (await GetInsightsAsync(client)).Streaks;

        Assert.Equal(2, streaks.Current);
        Assert.Equal(new StreakRun(3, Today.AddDays(-7), Today.AddDays(-5)), streaks.Longest);
    }

    [Fact]
    public async Task Insights_Today_FollowsTheSavedTimeZone()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await RateAsync(client, Today, 9);

        // Noon UTC is already the next day at UTC+14, so the rated day was yesterday there.
        await client.SaveSettingAsync("TimeZone", "Pacific/Kiritimati");
        var insights = await GetInsightsAsync(client);

        Assert.Equal(Today.AddDays(1), insights.Today);
        Assert.Equal(1, insights.Streaks.Current);
    }

    private static async Task<InsightsResponse> GetInsightsAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<InsightsResponse>("/api/insights", TestJson.Options))!;

    /// <summary>Rates the day on that day, since past days are read-only.</summary>
    private async Task RateAsync(HttpClient client, DateOnly date, int rating)
    {
        using var _ = factory.Clock.TravelTo(date);
        await client.RateDayAsync(date, rating);
    }

    /// <summary>Adds a sub-entry on its own day, since past days are read-only.</summary>
    private async Task<SubEntryResponse> AddAsync(HttpClient client, DateOnly date, string category)
    {
        using var _ = factory.Clock.TravelTo(date);
        return await client.AddSubEntryAsync(date, category, $"A {category} thing");
    }
}
