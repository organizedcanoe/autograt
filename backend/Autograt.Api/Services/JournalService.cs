using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>
/// Journal operations for a single user. Records are only ever added, never edited.
/// </summary>
public class JournalService(AutogratDbContext db)
{
    public const int HeatmapDays = 30;

    /// <summary>
    /// Creates the day's entry with its rating and one sub-entry per non-blank item.
    /// Conflicts if the user already has an entry for that date.
    /// </summary>
    public async Task<ServiceResult<DayDetailResponse>> CreateEntryAsync(int userId, CreateEntryRequest request)
    {
        var entryDate = request.EntryDate!.Value;
        if (await db.JournalEntries.AnyAsync(e => e.UserId == userId && e.EntryDate == entryDate))
        {
            return ServiceResult<DayDetailResponse>.Conflict();
        }

        var entry = new JournalEntry
        {
            UserId = userId,
            EntryDate = entryDate,
            DayRating = request.DayRating!.Value,
        };
        foreach (var item in request.SubEntries.Where(s => !string.IsNullOrWhiteSpace(s.Content)))
        {
            entry.SubEntries.Add(new JournalSubEntry { Category = item.Category!.Value, Content = item.Content!.Trim() });
        }

        db.JournalEntries.Add(entry);
        await db.SaveChangesAsync();

        return ServiceResult<DayDetailResponse>.Success((await GetDayAsync(userId, entryDate))!);
    }

    /// <returns>The day's rating, sub-entries and appends in chronological order, or null if there is no entry.</returns>
    public async Task<DayDetailResponse?> GetDayAsync(int userId, DateOnly entryDate)
    {
        var entry = await db.JournalEntries
            .AsNoTracking()
            .Include(e => e.SubEntries)
            .ThenInclude(s => s.Appends)
            .SingleOrDefaultAsync(e => e.UserId == userId && e.EntryDate == entryDate);

        if (entry is null)
        {
            return null;
        }

        var subEntries = entry.SubEntries
            .OrderBy(s => s.CreatedAtUtc).ThenBy(s => s.Id)
            .Select(ToResponse)
            .ToList();
        return new DayDetailResponse(entry.EntryDate, entry.DayRating, subEntries);
    }

    /// <returns>The new sub-entry, or null if the user has no entry for that date.</returns>
    public async Task<SubEntryResponse?> AddSubEntryAsync(int userId, DateOnly entryDate, CreateSubEntryRequest request)
    {
        var entryId = await db.JournalEntries
            .Where(e => e.UserId == userId && e.EntryDate == entryDate)
            .Select(e => (int?)e.Id)
            .SingleOrDefaultAsync();

        if (entryId is null)
        {
            return null;
        }

        var subEntry = new JournalSubEntry
        {
            JournalEntryId = entryId.Value,
            Category = request.Category!.Value,
            Content = request.Content.Trim(),
        };
        db.JournalSubEntries.Add(subEntry);
        await db.SaveChangesAsync();
        return ToResponse(subEntry);
    }

    /// <returns>The new append, or null if the sub-entry does not exist or belongs to another user.</returns>
    public async Task<AppendResponse?> AddAppendAsync(int userId, int subEntryId, CreateAppendRequest request)
    {
        var ownsSubEntry = await db.JournalSubEntries
            .AnyAsync(s => s.Id == subEntryId && s.JournalEntry!.UserId == userId);

        if (!ownsSubEntry)
        {
            return null;
        }

        var append = new JournalAppend { JournalSubEntryId = subEntryId, Content = request.Content.Trim() };
        db.JournalAppends.Add(append);
        await db.SaveChangesAsync();
        return ToResponse(append);
    }

    /// <summary>
    /// Returns one item per day for the <see cref="HeatmapDays"/> days ending on <paramref name="today"/>,
    /// oldest first. Days without an entry have a null rating and a count of zero.
    /// </summary>
    public async Task<List<HeatmapDayResponse>> GetHeatmapAsync(int userId, DateOnly today)
    {
        var firstDay = today.AddDays(-(HeatmapDays - 1));
        var entriesByDate = await db.JournalEntries
            .Where(e => e.UserId == userId && e.EntryDate >= firstDay && e.EntryDate <= today)
            .Select(e => new
            {
                e.EntryDate,
                e.DayRating,
                EntryCount = e.SubEntries.Count + e.SubEntries.Sum(s => s.Appends.Count),
            })
            .ToDictionaryAsync(e => e.EntryDate);

        return Enumerable.Range(0, HeatmapDays)
            .Select(offset => firstDay.AddDays(offset))
            .Select(date => entriesByDate.TryGetValue(date, out var entry)
                ? new HeatmapDayResponse(date, entry.DayRating, entry.EntryCount)
                : new HeatmapDayResponse(date, null, 0))
            .ToList();
    }

    private static SubEntryResponse ToResponse(JournalSubEntry subEntry) => new(
        subEntry.Id,
        subEntry.Category,
        subEntry.Content,
        subEntry.CreatedAtUtc,
        subEntry.Appends.OrderBy(a => a.CreatedAtUtc).ThenBy(a => a.Id).Select(ToResponse).ToList());

    private static AppendResponse ToResponse(JournalAppend append) =>
        new(append.Id, append.JournalSubEntryId, append.Content, append.CreatedAtUtc);
}
