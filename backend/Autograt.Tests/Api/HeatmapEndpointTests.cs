using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

public class HeatmapEndpointTests(AutogratApiFactory factory) : IClassFixture<AutogratApiFactory>
{
    private static readonly DateOnly Today = new(2026, 9, 23);

    [Fact]
    public async Task Heatmap_Returns30ContiguousDaysEndingToday()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var days = await GetHeatmapAsync(client);

        Assert.Equal(30, days.Count);
        Assert.Equal(Today.AddDays(-29), days[0].Date);
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
    public async Task Heatmap_ExcludesEntriesOutsideTheWindow()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(client, Today.AddDays(-30), dayRating: 4, subEntryCount: 1);
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

    [Theory]
    [InlineData("/api/journal/heatmap")]
    [InlineData("/api/journal/heatmap?today=not-a-date")]
    public async Task Heatmap_MissingOrInvalidToday_Returns400(string url)
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<List<HeatmapDayResponse>> GetHeatmapAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<List<HeatmapDayResponse>>($"/api/journal/heatmap?today={Today:yyyy-MM-dd}", TestJson.Options))!;

    /// <summary>Creates the entry on its own day, since past days are read-only.</summary>
    /// <returns>The ID of the first sub-entry created.</returns>
    private async Task<int> CreateEntryAsync(HttpClient client, DateOnly date, int dayRating, int subEntryCount)
    {
        using var _ = factory.Clock.TravelTo(date);
        var response = await client.PostAsJsonAsync("/api/journal/entries", new
        {
            entryDate = date,
            dayRating,
            subEntries = Enumerable.Range(1, subEntryCount).Select(i => new { category = "Good", content = $"Thing {i}" }),
        });
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<DayDetailResponse>(TestJson.Options);
        return created!.SubEntries[0].Id;
    }
}
