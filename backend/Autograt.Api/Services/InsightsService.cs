using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>
/// Summarises a user's journal: average ratings, entries per category and streaks of journaled days. A day is
/// journaled when it has at least one sub-entry or a rating. "Today" follows the user's time zone, or UTC without one.
/// </summary>
public class InsightsService(AutogratDbContext db, SettingsService settingsService, TimeProvider timeProvider)
{
    public async Task<InsightsResponse> GetInsightsAsync(int userId)
    {
        var timeZone = await settingsService.GetTimeZoneAsync(userId);
        var today = JournalDates.ToLocalDate(timeProvider.GetUtcNow(), timeZone);

        var days = await db.JournalEntries
            .AsNoTracking()
            .Where(e => e.UserId == userId && (e.DayRating != null || e.SubEntries.Any()))
            .Select(e => new { e.EntryDate, e.DayRating })
            .ToListAsync();

        var countsByCategory = await db.JournalSubEntries
            .AsNoTracking()
            .Where(s => s.JournalEntry!.UserId == userId)
            .GroupBy(s => s.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Category, g => g.Count);

        RatingAverage AverageSince(DateOnly from) =>
            InsightsStats.GetAverage(days.Where(d => d.EntryDate >= from && d.EntryDate <= today).Select(d => d.DayRating));

        var ratings = new RatingAverages(
            InsightsStats.GetAverage(days.Select(d => d.DayRating)),
            AverageSince(today.AddDays(-6)),
            AverageSince(today.AddDays(-29)));
        var categories = new CategoryCounts(
            countsByCategory.GetValueOrDefault(EntryCategory.Good),
            countsByCategory.GetValueOrDefault(EntryCategory.Bad),
            countsByCategory.GetValueOrDefault(EntryCategory.Neutral));
        var streaks = InsightsStats.GetStreaks(days.Select(d => d.EntryDate), today);

        return new InsightsResponse(today, ratings, categories, streaks);
    }
}
