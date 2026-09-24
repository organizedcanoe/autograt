using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace Autograt.Tests.Api;

// Tests share one database; each test registers its own user so their data never overlaps.
public class JournalEndpointsTests(AutogratApiFactory factory) : IClassFixture<AutogratApiFactory>
{
    private const string Today = "2026-09-23";
    private const string Yesterday = "2026-09-22";
    private const string ReadOnlyTitle = "Past days are read-only. You can still append notes.";

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
    public async Task CreateEntry_ForPastDay_Returns400()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync("/api/journal/entries", new { entryDate = Yesterday, dayRating = 5 });

        await AssertReadOnlyAsync(response);
    }

    [Fact]
    public async Task CreateEntry_WhileStillTodayInTheLatestTimeZone_Succeeds()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        // 11:59 UTC on the 24th is still 23:59 on the 23rd in UTC-12.
        using var _ = factory.Clock.TravelTo(new DateTimeOffset(2026, 9, 24, 11, 59, 0, TimeSpan.Zero));

        var response = await client.PostAsJsonAsync("/api/journal/entries", new { entryDate = Today, dayRating = 5 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task CreateEntry_OnceTodayHasEndedEverywhere_Returns400()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        using var _ = factory.Clock.TravelTo(new DateTimeOffset(2026, 9, 24, 12, 0, 0, TimeSpan.Zero));

        var response = await client.PostAsJsonAsync("/api/journal/entries", new { entryDate = Today, dayRating = 5 });

        await AssertReadOnlyAsync(response);
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
    public async Task AddSubEntry_ToPastDay_Returns400()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await CreatePastEntryAsync(client);

        var response = await client.PostAsJsonAsync($"/api/journal/entries/{Yesterday}/sub-entries",
            new { category = "Good", content = "Too late" });

        await AssertReadOnlyAsync(response);
    }

    [Fact]
    public async Task UpdateSubEntry_ForToday_ChangesContentAndCategory_KeepingAppends()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreateEntryAsync(client)).SubEntries[0];
        await client.PostAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}/appends", new { content = "A note" });

        var response = await client.PutAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}",
            new { category = "Bad", content = "  Coffee went cold  " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var day = await client.GetFromJsonAsync<DayDetailResponse>($"/api/journal/entries/{Today}", TestJson.Options);
        var saved = day!.SubEntries.Single(s => s.Id == subEntry.Id);
        Assert.Equal((EntryCategory.Bad, "Coffee went cold"), (saved.Category, saved.Content));
        Assert.Equal(subEntry.CreatedAtUtc, saved.CreatedAtUtc);
        Assert.Equal(["A note"], saved.Appends.Select(a => a.Content));
    }

    [Fact]
    public async Task UpdateSubEntry_OnPastDay_Returns400AndKeepsContent()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreatePastEntryAsync(client)).SubEntries[0];

        var response = await client.PutAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}",
            new { category = "Good", content = "Rewritten" });

        await AssertReadOnlyAsync(response);
        var day = await client.GetFromJsonAsync<DayDetailResponse>($"/api/journal/entries/{Yesterday}", TestJson.Options);
        Assert.Equal(subEntry.Content, day!.SubEntries.Single().Content);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateSubEntry_EmptyContent_Returns400(string content)
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreateEntryAsync(client)).SubEntries[0];

        var response = await client.PutAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}", new { category = "Good", content });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateSubEntry_OtherUsersSubEntry_Returns404()
    {
        var owner = await factory.CreateAuthenticatedClientAsync();
        var stranger = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreateEntryAsync(owner)).SubEntries[0];

        var response = await stranger.PutAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}",
            new { category = "Good", content = "Sneaky" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRating_ForToday_ChangesRating()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(client);

        var response = await client.PutAsJsonAsync($"/api/journal/entries/{Today}/rating", new { dayRating = 2 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var day = await client.GetFromJsonAsync<DayDetailResponse>($"/api/journal/entries/{Today}", TestJson.Options);
        Assert.Equal(2, day!.DayRating);
    }

    [Fact]
    public async Task UpdateRating_ForPastDay_Returns400AndKeepsRating()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var created = await CreatePastEntryAsync(client);

        var response = await client.PutAsJsonAsync($"/api/journal/entries/{Yesterday}/rating", new { dayRating = 2 });

        await AssertReadOnlyAsync(response);
        var day = await client.GetFromJsonAsync<DayDetailResponse>($"/api/journal/entries/{Yesterday}", TestJson.Options);
        Assert.Equal(created.DayRating, day!.DayRating);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(11)]
    public async Task UpdateRating_OutOfRange_Returns400(int dayRating)
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        await CreateEntryAsync(client);

        var response = await client.PutAsJsonAsync($"/api/journal/entries/{Today}/rating", new { dayRating });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRating_WithNoEntryForDay_Returns404()
    {
        var client = await factory.CreateAuthenticatedClientAsync();

        var response = await client.PutAsJsonAsync($"/api/journal/entries/{Today}/rating", new { dayRating = 5 });

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

    [Fact]
    public async Task Append_ToPastDay_IsAllowed()
    {
        var client = await factory.CreateAuthenticatedClientAsync();
        var subEntry = (await CreatePastEntryAsync(client)).SubEntries[0];

        var response = await client.PostAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}/appends", new { content = "Looking back" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
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
    public async Task UpdatingEntriesOrAppendsDirectly_IsNotAllowed(string method)
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

    /// <summary>Creates yesterday's entry by writing it while yesterday was still today.</summary>
    private async Task<DayDetailResponse> CreatePastEntryAsync(HttpClient client)
    {
        using var _ = factory.Clock.TravelTo(DateOnly.Parse(Yesterday));
        return await CreateEntryAsync(client, Yesterday);
    }

    private static async Task AssertReadOnlyAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(TestJson.Options);
        Assert.Equal(ReadOnlyTitle, problem!.Title);
    }

    private static async Task<DayDetailResponse> CreateEntryAsync(HttpClient client, string entryDate = Today)
    {
        var response = await client.PostAsJsonAsync("/api/journal/entries", new
        {
            entryDate,
            dayRating = 7,
            subEntries = new[] { new { category = "Good", content = "Coffee with a friend" } },
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<DayDetailResponse>(TestJson.Options))!;
    }
}
