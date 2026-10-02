using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

public class ImportEndpointsTests : IClassFixture<AutogratApiFactory>
{
    private static readonly DateOnly Today = TestClock.DefaultToday;
    private static readonly DateOnly Yesterday = Today.AddDays(-1);
    private static readonly DateOnly LastYear = Today.AddYears(-1);
    private static readonly DateTime OriginalTime = new(2025, 9, 23, 13, 5, 0, DateTimeKind.Utc);

    private readonly AutogratApiFactory _factory;

    public ImportEndpointsTests(AutogratApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Import_WithoutToken_Returns401()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/import", ValidFile());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Import_IntoEmptyAccount_CreatesDaysWithOriginalTimestamps()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var result = await ImportAsync(client, ValidFile());

        Assert.Equal(1, result.ImportedDays);
        Assert.Empty(result.ReplacedDays);
        var day = await GetDayAsync(client, LastYear);
        Assert.Equal(7, day.DayRating);
        var subEntry = Assert.Single(day.SubEntries);
        Assert.Equal(EntryCategory.Good, subEntry.Category);
        Assert.Equal("Walked the dog", subEntry.Content);
        Assert.Equal(OriginalTime, subEntry.CreatedAtUtc);
        var append = Assert.Single(subEntry.Appends);
        Assert.Equal("It rained later", append.Content);
        Assert.Equal(OriginalTime.AddDays(1), append.CreatedAtUtc);
    }

    [Fact]
    public async Task Import_DayAlreadyInDatabase_IsReplacedByTheFile()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        using (_factory.Clock.TravelTo(LastYear))
        {
            var old = await client.AddSubEntryAsync(LastYear, "Bad", "Old entry");
            await client.PostAsJsonAsync($"/api/journal/sub-entries/{old.Id}/appends", new { content = "Old append" });
            await client.RateDayAsync(LastYear, 2);
        }

        var result = await ImportAsync(client, ValidFile());

        Assert.Equal(1, result.ImportedDays);
        Assert.Equal([LastYear], result.ReplacedDays);
        var day = await GetDayAsync(client, LastYear);
        Assert.Equal(7, day.DayRating);
        var subEntry = Assert.Single(day.SubEntries);
        Assert.Equal("Walked the dog", subEntry.Content);
        Assert.Equal("It rained later", Assert.Single(subEntry.Appends).Content);
    }

    [Fact]
    public async Task Import_DayOnlyInDatabase_IsLeftUntouched()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        SubEntryResponse kept;
        using (_factory.Clock.TravelTo(Yesterday))
        {
            kept = await client.AddSubEntryAsync(Yesterday, "Neutral", "Kept entry");
            await client.RateDayAsync(Yesterday, 4);
        }
        await client.PostAsJsonAsync($"/api/journal/sub-entries/{kept.Id}/appends", new { content = "Kept append" });
        var before = await GetDayAsync(client, Yesterday);

        await ImportAsync(client, ValidFile());

        var after = await GetDayAsync(client, Yesterday);
        Assert.Equal(before.DayRating, after.DayRating);
        var subEntry = Assert.Single(after.SubEntries);
        Assert.Equal(before.SubEntries[0], subEntry with { Appends = before.SubEntries[0].Appends });
        Assert.Equal(before.SubEntries[0].Appends, subEntry.Appends);
    }

    [Fact]
    public async Task Import_SameFileTwice_LeavesTheSameDataWithoutDuplicates()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        await ImportAsync(client, ValidFile());
        var second = await ImportAsync(client, ValidFile());

        Assert.Equal([LastYear], second.ReplacedDays);
        var day = await GetDayAsync(client, LastYear);
        Assert.Single(Assert.Single(day.SubEntries).Appends);
    }

    [Fact]
    public async Task Import_Settings_OverwriteSavedValues_AndLeaveOthersUntouched()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        await client.PutAsJsonAsync("/api/settings/ColourTheme", new { values = new[] { "pink" } });
        await client.PutAsJsonAsync("/api/settings/BrightnessTheme", new { values = new[] { "dark" } });

        var result = await ImportAsync(client, ValidFile());

        Assert.Equal(2, result.SettingsImported);
        var settings = (await client.GetFromJsonAsync<List<SettingResponse>>("/api/settings", TestJson.Options))!
            .ToDictionary(s => s.Setting, s => s.Values);
        Assert.Equal(["jade"], settings[Setting.ColourTheme]);
        Assert.Equal(["08:30", "20:00"], settings[Setting.ReminderTime]);
        Assert.Equal(["dark"], settings[Setting.BrightnessTheme]);
    }

    [Fact]
    public async Task Import_AnotherUsersExport_RoundTrips()
    {
        var alice = await _factory.CreateAuthenticatedClientAsync();
        var bob = await _factory.CreateAuthenticatedClientAsync();
        await alice.PutAsJsonAsync("/api/settings/ColourTheme", new { values = new[] { "violet" } });
        SubEntryResponse walk;
        using (_factory.Clock.TravelTo(Yesterday))
        {
            walk = await alice.AddSubEntryAsync(Yesterday, "Good", "Walked the dog");
            await alice.RateDayAsync(Yesterday, 8);
        }
        await alice.PostAsJsonAsync($"/api/journal/sub-entries/{walk.Id}/appends", new { content = "It rained later" });
        await alice.AddSubEntryAsync(Today, "Bad", "Stubbed a toe");
        var aliceExport = await alice.GetFromJsonAsync<JournalExport>("/api/export?format=json", TestJson.Options);

        var response = await bob.PostAsJsonAsync("/api/import", aliceExport, TestJson.Options);
        response.EnsureSuccessStatusCode();

        var bobExport = await bob.GetFromJsonAsync<JournalExport>("/api/export?format=json", TestJson.Options);
        Assert.Equal(ToComparableJson(aliceExport!), ToComparableJson(bobExport!));
    }

    [Fact]
    public async Task Import_FileNamingAnotherUser_GoesIntoTheSignedInAccountOnly()
    {
        var aliceName = $"alice-{Guid.NewGuid():N}"[..16];
        var alice = await _factory.CreateAuthenticatedClientAsync(aliceName);
        var bob = await _factory.CreateAuthenticatedClientAsync();
        var file = ValidFile();
        file["username"] = aliceName;

        await ImportAsync(bob, file);

        Assert.Equal("Walked the dog", Assert.Single((await GetDayAsync(bob, LastYear)).SubEntries).Content);
        var aliceExport = await alice.GetFromJsonAsync<JournalExport>("/api/export?format=json", TestJson.Options);
        Assert.Empty(aliceExport!.Entries);
        Assert.Empty(aliceExport.Settings);
    }

    [Fact]
    public async Task Import_RatingOnlyDayWithNoSubEntries_IsAllowed()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        var file = ValidFile();
        file["entries"]![0]!["subEntries"] = new JsonArray();

        var result = await ImportAsync(client, file);

        Assert.Equal(1, result.ImportedDays);
        Assert.Empty((await GetDayAsync(client, LastYear)).SubEntries);
    }

    [Fact]
    public async Task Import_DayThatHasNotStartedInTheSavedTimeZone_Returns400()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        await client.SaveSettingAsync("TimeZone", "America/Toronto");
        var file = ValidFile();
        // Noon UTC on the 23rd is 08:00 on the 23rd in Toronto, though the 24th has started in UTC+14.
        file["entries"]!.AsArray().Add(Day(Today.AddDays(1), "Too soon"));

        var response = await client.PostAsJsonAsync("/api/import", file);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Import_WithATimeZoneInTheFile_UsesItForTheFutureCheck()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        await client.SaveSettingAsync("TimeZone", "America/Toronto");
        var file = ValidFile();
        file["settings"]!.AsArray().Add(new JsonObject { ["setting"] = "TimeZone", ["values"] = new JsonArray("Asia/Tokyo") });
        file["entries"]!.AsArray().Add(Day(Today.AddDays(1), "Already tomorrow in Tokyo"));
        // 20:00 UTC on the 23rd is 05:00 on the 24th in Tokyo, but 16:00 on the 23rd in Toronto.
        using var _ = _factory.Clock.TravelTo(new DateTimeOffset(2026, 9, 23, 20, 0, 0, TimeSpan.Zero));

        var result = await ImportAsync(client, file);

        Assert.Equal(2, result.ImportedDays);
    }

    public static TheoryData<string, Action<JsonNode>> InvalidFiles => new()
    {
        { "wrong format", file => file["format"] = "something-else" },
        { "unknown version", file => file["version"] = 2 },
        { "missing version", file => file.AsObject().Remove("version") },
        { "invalid date", file => BrokenDay(file)["date"] = "2025-02-30" },
        { "future date", file => BrokenDay(file)["date"] = Today.AddDays(2).ToString("yyyy-MM-dd") },
        { "repeated date", file => file["entries"]!.AsArray().Add(BrokenDay(file).DeepClone()) },
        { "rating too high", file => BrokenDay(file)["rating"] = 11 },
        { "rating negative", file => BrokenDay(file)["rating"] = -1 },
        { "unknown category", file => BrokenDay(file)["subEntries"]![0]!["category"] = "Great" },
        { "numeric category out of range", file => BrokenDay(file)["subEntries"]![0]!["category"] = 9 },
        { "empty sub-entry content", file => BrokenDay(file)["subEntries"]![0]!["content"] = " " },
        { "empty append content", file => BrokenDay(file)["subEntries"]![0]!["appends"]![0]!["content"] = "" },
        { "missing entry createdAtUtc", file => BrokenDay(file).AsObject().Remove("createdAtUtc") },
        { "missing sub-entry createdAtUtc", file => BrokenDay(file)["subEntries"]![0]!.AsObject().Remove("createdAtUtc") },
        { "missing append createdAtUtc", file => BrokenDay(file)["subEntries"]![0]!["appends"]![0]!.AsObject().Remove("createdAtUtc") },
        { "invalid setting value", file => file["settings"]![0]!["values"] = new JsonArray("rainbow") },
        { "unknown setting", file => file["settings"]![0]!["setting"] = "FontSize" },
        { "repeated setting", file => file["settings"]!.AsArray().Add(file["settings"]![0]!.DeepClone()) },
    };

    [Theory]
    [MemberData(nameof(InvalidFiles))]
    public async Task Import_InvalidFile_Returns400_AndWritesNothing(string problem, Action<JsonNode> breakFile)
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        var file = ValidFile();
        // A valid day before the broken one proves nothing is written when only part of the file is invalid.
        file["entries"]!.AsArray().Insert(0, Day(LastYear.AddDays(-1), "Valid day"));
        breakFile(file);

        var response = await client.PostAsJsonAsync("/api/import", file);

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{problem}: expected 400, got {(int)response.StatusCode}");
        var export = await client.GetFromJsonAsync<JournalExport>("/api/export?format=json", TestJson.Options);
        Assert.Empty(export!.Entries);
        Assert.Empty(export.Settings);
    }

    /// <summary>The day the invalid-file tests break: the second one, after a valid day.</summary>
    private static JsonNode BrokenDay(JsonNode file) => file["entries"]![1]!;

    private static JsonObject ValidFile() => new()
    {
        ["format"] = "autograt-export",
        ["version"] = 1,
        ["exportedAtUtc"] = "2026-09-23T12:00:00Z",
        ["username"] = "someone-else",
        ["settings"] = new JsonArray(
            new JsonObject { ["setting"] = "ColourTheme", ["values"] = new JsonArray("jade") },
            new JsonObject { ["setting"] = "ReminderTime", ["values"] = new JsonArray("08:30", "20:00") }),
        ["entries"] = new JsonArray(Day(LastYear, "Walked the dog")),
    };

    private static JsonObject Day(DateOnly date, string content) => new()
    {
        ["date"] = date.ToString("yyyy-MM-dd"),
        ["rating"] = 7,
        ["createdAtUtc"] = OriginalTime,
        ["subEntries"] = new JsonArray(new JsonObject
        {
            ["category"] = "Good",
            ["content"] = content,
            ["createdAtUtc"] = OriginalTime,
            ["appends"] = new JsonArray(new JsonObject
            {
                ["content"] = "It rained later",
                ["createdAtUtc"] = OriginalTime.AddDays(1),
            }),
        }),
    };

    private static async Task<ImportResponse> ImportAsync(HttpClient client, JsonNode file)
    {
        var response = await client.PostAsJsonAsync("/api/import", file);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<ImportResponse>(TestJson.Options))!;
    }

    private static async Task<DayDetailResponse> GetDayAsync(HttpClient client, DateOnly date) =>
        (await client.GetFromJsonAsync<DayDetailResponse>($"/api/journal/entries/{date:yyyy-MM-dd}", TestJson.Options))!;

    private static string ToComparableJson(JournalExport export) =>
        System.Text.Json.JsonSerializer.Serialize(export with { Username = null, ExportedAtUtc = null }, TestJson.Options);
}
