using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Api;

public class SettingsEndpointsTests : IClassFixture<AutogratApiFactory>
{
    private readonly AutogratApiFactory _factory;

    public SettingsEndpointsTests(AutogratApiFactory factory) => _factory = factory;

    [Fact]
    public async Task GetSettings_WithoutToken_Returns401()
    {
        var response = await _factory.CreateClient().GetAsync("/api/settings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSettings_NothingSaved_ReturnsDefaults()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var settings = await GetSettingsAsync(client);

        Assert.Equal(["system"], settings[Setting.BrightnessTheme]);
        Assert.Equal(["azure"], settings[Setting.ColourTheme]);
    }

    [Fact]
    public async Task UpdateSetting_ValidValue_ReturnsItAndPersists()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.PutAsJsonAsync("/api/settings/BrightnessTheme", new { values = new[] { "dark" } });

        response.EnsureSuccessStatusCode();
        var updated = await response.Content.ReadFromJsonAsync<SettingResponse>(TestJson.Options);
        Assert.Equal(new[] { "dark" }, updated!.Values);
        var settings = await GetSettingsAsync(client);
        Assert.Equal(["dark"], settings[Setting.BrightnessTheme]);
        Assert.Equal(["azure"], settings[Setting.ColourTheme]);
    }

    [Fact]
    public async Task UpdateSetting_Twice_KeepsOnlyTheLatestValue()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        await PutSettingAsync(client, "ColourTheme", "jade");
        await PutSettingAsync(client, "ColourTheme", "violet");

        var settings = await GetSettingsAsync(client);
        Assert.Equal(["violet"], settings[Setting.ColourTheme]);
    }

    [Fact]
    public async Task UpdateSetting_OnlyAffectsTheSignedInUser()
    {
        var alice = await _factory.CreateAuthenticatedClientAsync();
        var bob = await _factory.CreateAuthenticatedClientAsync();

        await PutSettingAsync(alice, "ColourTheme", "pink");

        var bobSettings = await GetSettingsAsync(bob);
        Assert.Equal(["azure"], bobSettings[Setting.ColourTheme]);
    }

    [Theory]
    [InlineData("BrightnessTheme", new[] { "purple" })]
    [InlineData("ColourTheme", new[] { "rainbow" })]
    [InlineData("ColourTheme", new string[0])]
    [InlineData("ColourTheme", new[] { "jade", "azure" })]
    public async Task UpdateSetting_InvalidValues_Returns400(string setting, string[] values)
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.PutAsJsonAsync($"/api/settings/{setting}", new { values });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("NotASetting")]
    [InlineData("99")]
    public async Task UpdateSetting_UnknownSetting_Returns404(string setting)
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.PutAsJsonAsync($"/api/settings/{setting}", new { values = new[] { "dark" } });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<Dictionary<Setting, List<string>>> GetSettingsAsync(HttpClient client)
    {
        var settings = await client.GetFromJsonAsync<List<SettingResponse>>("/api/settings", TestJson.Options);
        return settings!.ToDictionary(s => s.Setting, s => s.Values.ToList());
    }

    private static async Task PutSettingAsync(HttpClient client, string setting, string value)
    {
        var response = await client.PutAsJsonAsync($"/api/settings/{setting}", new { values = new[] { value } });
        response.EnsureSuccessStatusCode();
    }
}
