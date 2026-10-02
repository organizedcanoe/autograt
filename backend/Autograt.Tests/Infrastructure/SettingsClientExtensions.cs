using System.Net.Http.Json;

namespace Autograt.Tests.Infrastructure;

public static class SettingsClientExtensions
{
    /// <summary>Saves the user's values for one setting, as the settings page does.</summary>
    public static async Task SaveSettingAsync(this HttpClient client, string setting, params string[] values)
    {
        var response = await client.PutAsJsonAsync($"/api/settings/{setting}", new { values });
        response.EnsureSuccessStatusCode();
    }
}
