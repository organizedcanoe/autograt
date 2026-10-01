using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Autograt.Api.Contracts;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

public class ExportEndpointsTests : IClassFixture<AutogratApiFactory>
{
    private static readonly DateOnly Today = TestClock.DefaultToday;
    private static readonly DateOnly Yesterday = Today.AddDays(-1);

    private readonly AutogratApiFactory _factory;

    public ExportEndpointsTests(AutogratApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Export_WithoutToken_Returns401()
    {
        var response = await _factory.CreateClient().GetAsync("/api/export?format=json");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/export?format=csv")]
    [InlineData("/api/export")]
    public async Task Export_UnknownFormat_Returns400(string url)
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ExportJson_IsAnAttachmentNamedAfterTheUserAndDate()
    {
        var username = $"exp-{Guid.NewGuid():N}"[..16];
        var client = await _factory.CreateAuthenticatedClientAsync(username);

        var response = await client.GetAsync("/api/export?format=json");

        response.EnsureSuccessStatusCode();
        Assert.Equal("application/json", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Equal($"autograt-{username}-{Today:yyyy-MM-dd}.json", response.Content.Headers.ContentDisposition.FileName?.Trim('"'));
    }

    [Fact]
    public async Task ExportJson_ContainsOnlyTheUsersData_NestedAndOrdered()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        var other = await _factory.CreateAuthenticatedClientAsync();
        await other.AddSubEntryAsync(Today, "Bad", "Not mine");

        SubEntryResponse walk;
        using (_factory.Clock.TravelTo(Yesterday))
        {
            walk = await client.AddSubEntryAsync(Yesterday, "Good", "Walked the dog");
            await client.AddSubEntryAsync(Yesterday, "Neutral", "Ate lunch");
            await client.RateDayAsync(Yesterday, 7);
        }
        await client.PostAsJsonAsync($"/api/journal/sub-entries/{walk.Id}/appends", new { content = "It rained later" });
        await client.AddSubEntryAsync(Today, "Bad", "Stubbed a toe");

        var export = await GetJsonExportAsync(client);

        Assert.Equal("autograt-export", export.Format);
        Assert.Equal(1, export.Version);
        Assert.Equal([Yesterday, Today], export.Entries.Select(e => e.Date!.Value));
        var yesterday = export.Entries[0];
        Assert.Equal(7, yesterday.Rating);
        Assert.Equal(["Walked the dog", "Ate lunch"], yesterday.SubEntries.Select(s => s.Content));
        Assert.Equal("It rained later", Assert.Single(yesterday.SubEntries[0].Appends).Content);
        Assert.Null(export.Entries[1].Rating);
        Assert.DoesNotContain(export.Entries.SelectMany(e => e.SubEntries), s => s.Content == "Not mine");
    }

    [Fact]
    public async Task ExportJson_UsesCategoryNames_AndLeavesOutIds()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        var subEntry = await client.AddSubEntryAsync(Today, "Good", "Walked the dog");
        await client.PostAsJsonAsync($"/api/journal/sub-entries/{subEntry.Id}/appends", new { content = "Later" });

        var json = await client.GetStringAsync("/api/export?format=json");

        using var document = JsonDocument.Parse(json);
        var subEntryJson = document.RootElement.GetProperty("entries")[0].GetProperty("subEntries")[0];
        Assert.Equal("Good", subEntryJson.GetProperty("category").GetString());
        Assert.DoesNotContain("\"id\"", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Id\"", json);
    }

    [Fact]
    public async Task ExportJson_IncludesSavedSettingsOnly()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        await client.PutAsJsonAsync("/api/settings/ColourTheme", new { values = new[] { "jade" } });
        await client.PutAsJsonAsync("/api/settings/ReminderTime", new { values = new[] { "08:30", "20:00" } });

        var export = await GetJsonExportAsync(client);

        Assert.Equal(2, export.Settings.Count);
        Assert.Equal(["jade"], export.Settings.Single(s => s.Setting == Autograt.Api.Models.Setting.ColourTheme).Values);
        Assert.Equal(["08:30", "20:00"], export.Settings.Single(s => s.Setting == Autograt.Api.Models.Setting.ReminderTime).Values);
    }

    [Fact]
    public async Task ExportMarkdown_RendersDaysNewestFirst_WithRatingsCategoriesAndAppends()
    {
        var username = $"md-{Guid.NewGuid():N}"[..16];
        var client = await _factory.CreateAuthenticatedClientAsync(username);
        SubEntryResponse walk;
        using (_factory.Clock.TravelTo(Yesterday))
        {
            walk = await client.AddSubEntryAsync(Yesterday, "Good", "Walked the dog");
            await client.RateDayAsync(Yesterday, 7);
        }
        var appendResponse = await client.PostAsJsonAsync($"/api/journal/sub-entries/{walk.Id}/appends", new { content = "It rained later" });
        var append = await appendResponse.Content.ReadFromJsonAsync<AppendResponse>(TestJson.Options);
        await client.AddSubEntryAsync(Today, "Bad", "Stubbed a toe");

        var response = await client.GetAsync("/api/export?format=markdown");

        response.EnsureSuccessStatusCode();
        Assert.Equal("text/markdown", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal($"autograt-{username}-{Today:yyyy-MM-dd}.md", response.Content.Headers.ContentDisposition!.FileName?.Trim('"'));
        var markdown = (await response.Content.ReadAsStringAsync()).ReplaceLineEndings("\n");
        var expected = $"""
            # Autograt journal: {username}
            Exported {Today:yyyy-MM-dd}

            ## {Today:yyyy-MM-dd} (unrated)
            - **Bad:** Stubbed a toe

            ## {Yesterday:yyyy-MM-dd} (rating 7/10)
            - **Good:** Walked the dog
              - _Added {append!.CreatedAtUtc:yyyy-MM-dd}:_ It rained later

            """;
        Assert.Equal(expected.ReplaceLineEndings("\n"), markdown);
    }

    private static async Task<JournalExport> GetJsonExportAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<JournalExport>("/api/export?format=json", TestJson.Options))!;
}
