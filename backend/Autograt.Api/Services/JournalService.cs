using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>
/// Journal operations for a single user. Today's rating and sub-entries can be edited, and today's sub-entries and
/// appends deleted; the day's entry is created by whichever comes first. Past days are read-only apart from new
/// appends, future days can't be written, and appends are never edited. "Today" follows the user's time zone.
/// </summary>
public class JournalService(AutogratDbContext db, SettingsService settingsService, TimeProvider timeProvider)
{
    /// <summary>The longest heatmap range, enough for a full leap year.</summary>
    public const int MaxHeatmapDays = 366;

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
    /// <returns>The updated day, or a failure if the date isn't today.</returns>
    public async Task<ServiceResult<DayDetailResponse>> UpdateRatingAsync(int userId, DateOnly entryDate, int dayRating)
    {
        if (await FindDateErrorAsync(userId, entryDate) is { } dateError)
        {
            return ServiceResult<DayDetailResponse>.Failure(dateError);
        }

        var entry = await FindOrAddEntryAsync(userId, entryDate);
        entry.DayRating = dayRating;
        await db.SaveChangesAsync();
        return ServiceResult<DayDetailResponse>.Success((await GetDayAsync(userId, entryDate))!);
    }

    /// <summary>Adds a sub-entry to today's entry, creating an unrated entry if the day has none yet.</summary>
    /// <returns>The new sub-entry, or a failure if the date isn't today.</returns>
    public async Task<ServiceResult<SubEntryResponse>> AddSubEntryAsync(int userId, DateOnly entryDate, SubEntryRequest request)
    {
        if (await FindDateErrorAsync(userId, entryDate) is { } dateError)
        {
            return ServiceResult<SubEntryResponse>.Failure(dateError);
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
    /// <returns>The updated sub-entry, or a failure if it is not the user's or its day isn't today.</returns>
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

        if (await FindDateErrorAsync(userId, subEntry.JournalEntry!.EntryDate) is { } dateError)
        {
            return ServiceResult<SubEntryResponse>.Failure(dateError);
        }

        subEntry.Category = request.Category!.Value;
        subEntry.Content = request.Content.Trim();
        await db.SaveChangesAsync();
        return ServiceResult<SubEntryResponse>.Success(ToResponse(subEntry));
    }

    /// <summary>Deletes one of today's sub-entries with its appends. The day's entry and rating are kept.</summary>
    /// <returns>The deleted sub-entry, or a failure if it is not the user's or its day isn't today.</returns>
    public async Task<ServiceResult<JournalSubEntry>> DeleteSubEntryAsync(int userId, int subEntryId)
    {
        var subEntry = await db.JournalSubEntries
            .Include(s => s.JournalEntry)
            .Include(s => s.Appends)
            .SingleOrDefaultAsync(s => s.Id == subEntryId && s.JournalEntry!.UserId == userId);

        if (subEntry is null)
        {
            return ServiceResult<JournalSubEntry>.Failure(ServiceError.NotFound);
        }

        if (await FindDateErrorAsync(userId, subEntry.JournalEntry!.EntryDate) is { } dateError)
        {
            return ServiceResult<JournalSubEntry>.Failure(dateError);
        }

        db.JournalSubEntries.Remove(subEntry);
        await db.SaveChangesAsync();
        return ServiceResult<JournalSubEntry>.Success(subEntry);
    }

    /// <summary>Deletes an append on one of today's sub-entries. Appends on past days are never deleted.</summary>
    /// <returns>The deleted append, or a failure if it is not the user's or its day isn't today.</returns>
    public async Task<ServiceResult<JournalAppend>> DeleteAppendAsync(int userId, int appendId)
    {
        var append = await db.JournalAppends
            .Include(a => a.JournalSubEntry!.JournalEntry)
            .SingleOrDefaultAsync(a => a.Id == appendId && a.JournalSubEntry!.JournalEntry!.UserId == userId);

        if (append is null)
        {
            return ServiceResult<JournalAppend>.Failure(ServiceError.NotFound);
        }

        if (await FindDateErrorAsync(userId, append.JournalSubEntry!.JournalEntry!.EntryDate) is { } dateError)
        {
            return ServiceResult<JournalAppend>.Failure(dateError);
        }

        db.JournalAppends.Remove(append);
        await db.SaveChangesAsync();
        return ServiceResult<JournalAppend>.Success(append);
    }

    /// <summary>Appends a note to a sub-entry. Unlike other changes, this is allowed on past days.</summary>
    /// <returns>The new append, or a failure if the sub-entry is not the user's or belongs to a future day.</returns>
    public async Task<ServiceResult<AppendResponse>> AddAppendAsync(int userId, int subEntryId, CreateAppendRequest request)
    {
        var entryDate = await db.JournalSubEntries
            .Where(s => s.Id == subEntryId && s.JournalEntry!.UserId == userId)
            .Select(s => (DateOnly?)s.JournalEntry!.EntryDate)
            .SingleOrDefaultAsync();

        if (entryDate is null)
        {
            return ServiceResult<AppendResponse>.Failure(ServiceError.NotFound);
        }

        if (await FindDateErrorAsync(userId, entryDate.Value) == ServiceError.FutureDay)
        {
            return ServiceResult<AppendResponse>.Failure(ServiceError.FutureDay);
        }

        var append = new JournalAppend { JournalSubEntryId = subEntryId, Content = request.Content.Trim() };
        db.JournalAppends.Add(append);
        await db.SaveChangesAsync();
        return ServiceResult<AppendResponse>.Success(ToResponse(append));
    }

    /// <summary>
    /// Returns one item per day from <paramref name="from"/> to <paramref name="to"/> (both inclusive),
    /// oldest first. Days without an entry have a null rating and a count of zero.
    /// </summary>
    public async Task<List<HeatmapDayResponse>> GetHeatmapAsync(int userId, DateOnly from, DateOnly to)
    {
        var entriesByDate = await db.JournalEntries
            .Where(e => e.UserId == userId && e.EntryDate >= from && e.EntryDate <= to)
            .Select(e => new
            {
                e.EntryDate,
                e.DayRating,
                EntryCount = e.SubEntries.Count + e.SubEntries.Sum(s => s.Appends.Count),
            })
            .ToDictionaryAsync(e => e.EntryDate);

        return Enumerable.Range(0, to.DayNumber - from.DayNumber + 1)
            .Select(offset => from.AddDays(offset))
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

    /// <returns>Why the day can't be changed, or null while it is today for the user.</returns>
    private async Task<ServiceError?> FindDateErrorAsync(int userId, DateOnly date)
    {
        var timeZone = await settingsService.GetTimeZoneAsync(userId);
        var now = timeProvider.GetUtcNow();
        if (JournalDates.IsPast(date, now, timeZone))
        {
            return ServiceError.ReadOnly;
        }

        return JournalDates.IsFuture(date, now, timeZone) ? ServiceError.FutureDay : null;
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
