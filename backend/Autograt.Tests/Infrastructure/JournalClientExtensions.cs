using System.Net.Http.Json;
using Autograt.Api.Contracts;

namespace Autograt.Tests.Infrastructure;

/// <summary>Seeds journal data through the API the same way the today page does: one call per entry.</summary>
public static class JournalClientExtensions
{
    public static async Task<SubEntryResponse> AddSubEntryAsync(this HttpClient client, DateOnly date, string category, string content)
    {
        var response = await client.PostAsJsonAsync($"/api/journal/entries/{date:yyyy-MM-dd}/sub-entries", new { category, content });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SubEntryResponse>(TestJson.Options))!;
    }

    public static async Task<DayDetailResponse> RateDayAsync(this HttpClient client, DateOnly date, int dayRating)
    {
        var response = await client.PutAsJsonAsync($"/api/journal/entries/{date:yyyy-MM-dd}/rating", new { dayRating });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<DayDetailResponse>(TestJson.Options))!;
    }
}
