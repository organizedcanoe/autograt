using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

public class SearchEndpointsTests(AutogratApiFactory factory) : IClassFixture<AutogratApiFactory>
{
    private static readonly DateOnly EntryDate = new(2026, 9, 20);

    [Fact]
    public async Task StandardQuery_MatchesSubEntriesAndAppends_IgnoringCase()
    {
        var client = await CreateSeededClientAsync();

        var results = await SearchAsync(client, "dog");

        Assert.Equal(["Dog got wet", "Pets: dog, cat", "Walked the dog"], results.Select(r => r.Content).Order());
    }

    [Fact]
    public async Task CommaQuery_MatchesAnyTerm()
    {
        var client = await CreateSeededClientAsync();

        var results = await SearchAsync(client, "cat, rainy");

        Assert.Equal(["Fed the cat", "Pets: dog, cat", "Rainy day"], results.Select(r => r.Content).Order());
    }

    [Fact]
    public async Task QuotedQuery_IsExactAndCaseSensitive_WithoutSplittingOnCommas()
    {
        var client = await CreateSeededClientAsync();

        var caseSensitive = await SearchAsync(client, "\"Dog\"");
        var withComma = await SearchAsync(client, "\"dog, cat\"");

        Assert.Equal(["Dog got wet"], caseSensitive.Select(r => r.Content));
        Assert.Equal(["Pets: dog, cat"], withComma.Select(r => r.Content));
    }

    [Fact]
    public async Task Results_IncludeTypeIdsAndDateForNavigation()
    {
        var client = await CreateSeededClientAsync();

        var append = Assert.Single(await SearchAsync(client, "got wet"));
        var subEntry = Assert.Single(await SearchAsync(client, "rainy"));

        Assert.Equal(SearchResultType.Append, append.Type);
        Assert.NotNull(append.AppendId);
        Assert.Equal(subEntry.SubEntryId, append.SubEntryId);
        Assert.Equal(SearchResultType.SubEntry, subEntry.Type);
        Assert.Null(subEntry.AppendId);
        Assert.Equal(EntryDate, append.EntryDate);
    }

    [Fact]
    public async Task Search_ExcludesOtherUsersRecords()
    {
        await CreateSeededClientAsync();
        var stranger = await factory.CreateAuthenticatedClientAsync();

        var results = await SearchAsync(stranger, "dog");

        Assert.Empty(results);
    }

    [Theory]
    [InlineData("/api/journal/search")]
    [InlineData("/api/journal/search?q=%20%20")]
    [InlineData("/api/journal/search?q=%22%22")]
    public async Task EmptyQuery_Returns400(string url)
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<List<SearchResultResponse>> SearchAsync(HttpClient client, string query) =>
        (await client.GetFromJsonAsync<List<SearchResultResponse>>(
            $"/api/journal/search?q={Uri.EscapeDataString(query)}", TestJson.Options))!;

    private async Task<HttpClient> CreateSeededClientAsync()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        using var _ = factory.Clock.TravelTo(EntryDate);
        var response = await client.PostAsJsonAsync("/api/journal/entries", new
        {
            entryDate = EntryDate,
            dayRating = 6,
            subEntries = new[]
            {
                new { category = "Good", content = "Walked the dog" },
                new { category = "Good", content = "Fed the cat" },
                new { category = "Bad", content = "Rainy day" },
                new { category = "Neutral", content = "Pets: dog, cat" },
            },
        });
        response.EnsureSuccessStatusCode();
        var day = await response.Content.ReadFromJsonAsync<DayDetailResponse>(TestJson.Options);

        var rainy = day!.SubEntries.Single(s => s.Content == "Rainy day");
        var append = await client.PostAsJsonAsync($"/api/journal/sub-entries/{rainy.Id}/appends", new { content = "Dog got wet" });
        append.EnsureSuccessStatusCode();

        return client;
    }
}
