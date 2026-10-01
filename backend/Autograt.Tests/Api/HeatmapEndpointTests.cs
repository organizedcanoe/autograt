using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

public class HeatmapEndpointTests(AutogratApiFactory factory) : IClassFixture<AutogratApiFactory>
{
    private static readonly DateOnly Today = new(2026, 9, 23);
    private static readonly DateOnly From = Today.AddDays(-29);

    [Fact]
    public async Task Heatmap_ReturnsOneContiguousDayPerDateFromFromToTo()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var days = await GetHeatmapAsync(client);

        Assert.Equal(30, days.Count);
        Assert.Equal(From, days[0].Date);
        Assert.Equal(Today, days[^1].Date);
        Assert.All(days.Zip(days.Skip(1)), pair => Assert.Equal(pair.First.Date.AddDays(1), pair.Second.Date));
        Assert.All(days, day => Assert.Equal((null, 0), (day.DayRating, day.EntryCount)));
    }

    [Fact]
    public async Task Heatmap_ReportsRatingAndCountOfSubEntriesPlusAppends()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var twoDaysAgo = Today.AddDays(-2);
        var subEntryId = await CreateEntryAsync(client, twoDaysAgo, dayRating: 9, subEntryCount: 2);
        await client.PostAsJsonAsync($"/api/journal/sub-entries/{subEntryId}/appends", new { content = "Later note" });

        var days = await GetHeatmapAsync(client);

        var day = days.Single(d => d.Date == twoDaysAgo);
        Assert.Equal(9, day.DayRating);
        Assert.Equal(3, day.EntryCount);
    }

    [Fact]
    public async Task Heatmap_UnratedDayWithEntries_ReportsNullRatingAndCount()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(client, Today, dayRating: null, subEntryCount: 2);

        var days = await GetHeatmapAsync(client);

        Assert.Equal((null, 2), (days[^1].DayRating, days[^1].EntryCount));
    }

    [Fact]
    public async Task Heatmap_ExcludesEntriesOutsideTheRange()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(client, From.AddDays(-1), dayRating: 4, subEntryCount: 1);
        await CreateEntryAsync(client, Today.AddDays(1), dayRating: 4, subEntryCount: 1);

        var days = await GetHeatmapAsync(client);

        Assert.All(days, day => Assert.Null(day.DayRating));
    }

    [Fact]
    public async Task Heatmap_ExcludesOtherUsersEntries()
    {
        var owner = await factory.CreateAuthenticatedClientAsync();
        var stranger = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(owner, Today, dayRating: 6, subEntryCount: 1);

        var days = await GetHeatmapAsync(stranger);

        Assert.Null(days[^1].DayRating);
    }

    [Fact]
    public async Task Heatmap_SingleDayRange_ReturnsThatDay()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var days = await GetHeatmapAsync(client, Today, Today);

        Assert.Equal(Today, Assert.Single(days).Date);
    }

    [Fact]
    public async Task Heatmap_MaximumRange_IsAllowed()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var from = Today.AddDays(-(JournalService.MaxHeatmapDays - 1));

        var days = await GetHeatmapAsync(client, from, Today);

        Assert.Equal(JournalService.MaxHeatmapDays, days.Count);
    }

    [Theory]
    [InlineData("/api/journal/heatmap")]
    [InlineData("/api/journal/heatmap?from=2026-09-01")]
    [InlineData("/api/journal/heatmap?to=2026-09-01")]
    [InlineData("/api/journal/heatmap?from=not-a-date&to=2026-09-01")]
    [InlineData("/api/journal/heatmap?from=2026-09-02&to=2026-09-01")]
    [InlineData("/api/journal/heatmap?from=2025-09-01&to=2026-09-02")]
    public async Task Heatmap_MissingInvalidReversedOrTooLongRange_Returns400(string url)
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static Task<List<HeatmapDayResponse>> GetHeatmapAsync(HttpClient client) => GetHeatmapAsync(client, From, Today);

    private static async Task<List<HeatmapDayResponse>> GetHeatmapAsync(HttpClient client, DateOnly from, DateOnly to) =>
        (await client.GetFromJsonAsync<List<HeatmapDayResponse>>(
            $"/api/journal/heatmap?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}", TestJson.Options))!;

    /// <summary>Creates the entry on its own day, since past days are read-only.</summary>
    /// <returns>The ID of the first sub-entry created.</returns>
    private async Task<int> CreateEntryAsync(HttpClient client, DateOnly date, int? dayRating, int subEntryCount)
    {
        using var _ = factory.Clock.TravelTo(date);
        var subEntries = new List<SubEntryResponse>();
        for (var i = 1; i <= subEntryCount; i++)
        {
            subEntries.Add(await client.AddSubEntryAsync(date, "Good", $"Thing {i}"));
        }

        if (dayRating is not null)
        {
            await client.RateDayAsync(date, dayRating.Value);
        }

        return subEntries[0].Id;
    }
}
