using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>
/// Journal operations for a single user. Today's rating and sub-entries can be edited, and the day's entry is
/// created by whichever comes first; past days are read-only apart from appends, and appends are never edited.
/// </summary>
public class JournalService(AutogratDbContext db, TimeProvider timeProvider)
{
    public const int HeatmapDays = 30;

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

    /// <summary>Sets the rating of today's entry, creating the entry if the day has none yet.</summary>
    /// <returns>The updated day, or a failure if the date is in the past.</returns>
    public async Task<ServiceResult<DayDetailResponse>> UpdateRatingAsync(int userId, DateOnly entryDate, int dayRating)
    {
        if (IsPastDay(entryDate))
        {
            return ServiceResult<DayDetailResponse>.Failure(ServiceError.ReadOnly);
        }

        var entry = await FindOrAddEntryAsync(userId, entryDate);
        entry.DayRating = dayRating;
        await db.SaveChangesAsync();
        return ServiceResult<DayDetailResponse>.Success((await GetDayAsync(userId, entryDate))!);
    }

    /// <summary>Adds a sub-entry to today's entry, creating an unrated entry if the day has none yet.</summary>
    /// <returns>The new sub-entry, or a failure if the date is in the past.</returns>
    public async Task<ServiceResult<SubEntryResponse>> AddSubEntryAsync(int userId, DateOnly entryDate, SubEntryRequest request)
    {
        if (IsPastDay(entryDate))
        {
            return ServiceResult<SubEntryResponse>.Failure(ServiceError.ReadOnly);
        }

        var entry = await FindOrAddEntryAsync(userId, entryDate);
        var subEntry = new JournalSubEntry
        {
            Category = request.Category!.Value,
            Content = request.Content.Trim(),
        };
        entry.SubEntries.Add(subEntry);
        await db.SaveChangesAsync();
        return ServiceResult<SubEntryResponse>.Success(ToResponse(subEntry));
    }

    /// <summary>Replaces the category and content of one of today's sub-entries, keeping its appends.</summary>
    /// <returns>The updated sub-entry, or a failure if it is not the user's or belongs to a past day.</returns>
    public async Task<ServiceResult<SubEntryResponse>> UpdateSubEntryAsync(int userId, int subEntryId, SubEntryRequest request)
    {
        var subEntry = await db.JournalSubEntries
            .Include(s => s.JournalEntry)
            .Include(s => s.Appends)
            .SingleOrDefaultAsync(s => s.Id == subEntryId && s.JournalEntry!.UserId == userId);

        if (subEntry is null)
        {
            return ServiceResult<SubEntryResponse>.Failure(ServiceError.NotFound);
        }

        if (IsPastDay(subEntry.JournalEntry!.EntryDate))
        {
            return ServiceResult<SubEntryResponse>.Failure(ServiceError.ReadOnly);
        }

        subEntry.Category = request.Category!.Value;
        subEntry.Content = request.Content.Trim();
        await db.SaveChangesAsync();
        return ServiceResult<SubEntryResponse>.Success(ToResponse(subEntry));
    }

    /// <summary>Appends a note to a sub-entry. Unlike other changes, this is allowed on past days.</summary>
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

    /// <summary>Returns the user's tracked entry for the date, or a new unrated one that the next save inserts.</summary>
    private async Task<JournalEntry> FindOrAddEntryAsync(int userId, DateOnly entryDate)
    {
        var entry = await db.JournalEntries.SingleOrDefaultAsync(e => e.UserId == userId && e.EntryDate == entryDate);
        if (entry is null)
        {
            entry = new JournalEntry { UserId = userId, EntryDate = entryDate };
            db.JournalEntries.Add(entry);
        }

        return entry;
    }

    private bool IsPastDay(DateOnly date) => JournalDates.IsPast(date, timeProvider.GetUtcNow());

    private static SubEntryResponse ToResponse(JournalSubEntry subEntry) => new(
        subEntry.Id,
        subEntry.Category,
        subEntry.Content,
        subEntry.CreatedAtUtc,
        subEntry.Appends.OrderBy(a => a.CreatedAtUtc).ThenBy(a => a.Id).Select(ToResponse).ToList());

    private static AppendResponse ToResponse(JournalAppend append) =>
        new(append.Id, append.JournalSubEntryId, append.Content, append.CreatedAtUtc);
}
