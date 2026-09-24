using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

// Tests share one database; each test registers its own user so their data never overlaps.
public class JournalEndpointsTests(AutogratApiFactory factory) : IClassFixture<AutogratApiFactory>
{
    private const string Today = "2026-09-23";

    [Fact]
    public async Task CreateEntry_WithoutDayRating_Returns400()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync("/api/journal/entries", new { entryDate = Today, subEntries = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(11)]
    public async Task CreateEntry_DayRatingOutOfRange_Returns400(int dayRating)
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync("/api/journal/entries", new { entryDate = Today, dayRating });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateEntry_WithoutEntryDate_Returns400()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync("/api/journal/entries", new { dayRating = 5 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateEntry_CreatesSubEntries_SkippingBlankOnes()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync("/api/journal/entries", new
        {
            entryDate = Today,
            dayRating = 8,
            subEntries = new[]
            {
                new { category = "Good", content = "Walked the dog" },
                new { category = "Good", content = "   " },
                new { category = "Bad", content = "Missed the bus" },
            },
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<DayDetailResponse>(TestJson.Options);
        Assert.Equal(8, created!.DayRating);
        Assert.Collection(created.SubEntries,
            s => Assert.Equal((EntryCategory.Good, "Walked the dog"), (s.Category, s.Content)),
            s => Assert.Equal((EntryCategory.Bad, "Missed the bus"), (s.Category, s.Content)));

        var fetched = await client.GetFromJsonAsync<DayDetailResponse>($"/api/journal/entries/{Today}", TestJson.Options);
        Assert.Equal(2, fetched!.SubEntries.Count);
    }

    [Fact]
    public async Task CreateEntry_SameDayTwice_Returns409()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(client);

        var response = await client.PostAsJsonAsync("/api/journal/entries", new { entryDate = Today, dayRating = 3 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task GetDay_WithNoEntry_Returns404()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.GetAsync($"/api/journal/entries/{Today}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetDay_OtherUsersEntry_Returns404()
    {
        var owner = await factory.CreateAuthenticatedClientAsync();
        var stranger = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(owner);

        var response = await stranger.GetAsync($"/api/journal/entries/{Today}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddSubEntry_ToExistingDay_AppearsLastInDayDetail()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(client);

        var response = await client.PostAsJsonAsync($"/api/journal/entries/{Today}/sub-entries",
            new { category = "Neutral", content = "Evening thought" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var day = await client.GetFromJsonAsync<DayDetailResponse>($"/api/journal/entries/{Today}", TestJson.Options);
        Assert.Equal("Evening thought", day!.SubEntries[^1].Content);
        Assert.Equal(EntryCategory.Neutral, day.SubEntries[^1].Category);
    }

    [Fact]
    public async Task AddSubEntry_WithNoEntryForDay_Returns404()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync($"/api/journal/entries/{Today}/sub-entries",
            new { category = "Good", content = "Orphan" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Append_CreatesAppendsInOrder_WithoutChangingSubEntry()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreateEntryAsync(client)).SubEntries[0];

        var first = await client.PostAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}/appends", new { content = "First note" });
        await client.PostAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}/appends", new { content = "Second note" });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var append = await first.Content.ReadFromJsonAsync<AppendResponse>(TestJson.Options);
        Assert.Equal(subEntry.Id, append!.SubEntryId);

        var day = await client.GetFromJsonAsync<DayDetailResponse>($"/api/journal/entries/{Today}", TestJson.Options);
        var saved = day!.SubEntries.Single(s => s.Id == subEntry.Id);
        Assert.Equal(subEntry.Content, saved.Content);
        Assert.Equal(subEntry.CreatedAtUtc, saved.CreatedAtUtc);
        Assert.Equal(["First note", "Second note"], saved.Appends.Select(a => a.Content));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Append_EmptyContent_Returns400(string content)
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreateEntryAsync(client)).SubEntries[0];

        var response = await client.PostAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}/appends", new { content });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Append_ToOtherUsersSubEntry_Returns404()
    {
        var owner = await factory.CreateAuthenticatedClientAsync();
        var stranger = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreateEntryAsync(owner)).SubEntries[0];

        var response = await stranger.PostAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}/appends", new { content = "Sneaky" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    public async Task UpdatingExistingRecords_IsNotAllowed(string method)
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreateEntryAsync(client)).SubEntries[0];
        var body = JsonContent.Create(new { content = "Rewritten" });

        var entryUpdate = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), $"/api/journal/entries/{Today}") { Content = body });
        var appendUpdate = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), $"/api/journal/sub-entries/{subEntry.Id}/appends") { Content = body });

        Assert.Equal(HttpStatusCode.MethodNotAllowed, entryUpdate.StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, appendUpdate.StatusCode);
    }

    [Fact]
    public async Task JournalEndpoints_WithoutToken_Return401()
    {
        var response = await factory.CreateClient().GetAsync($"/api/journal/entries/{Today}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static async Task<DayDetailResponse> CreateEntryAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/journal/entries", new
        {
            entryDate = Today,
            dayRating = 7,
            subEntries = new[] { new { category = "Good", content = "Coffee with a friend" } },
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<DayDetailResponse>(TestJson.Options))!;
    }
}
