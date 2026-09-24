using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

public class SearchService(AutogratDbContext db)
{
    /// <summary>
    /// Finds the user's sub-entries and appends containing any of the query's terms, newest first.
    /// </summary>
    public async Task<List<SearchResultResponse>> SearchAsync(int userId, SearchQuery query)
    {
        var results = new List<SearchResultResponse>();
        foreach (var term in query.Terms)
        {
            results.AddRange(await SearchSubEntriesAsync(userId, term, query.CaseSensitive));
            results.AddRange(await SearchAppendsAsync(userId, term, query.CaseSensitive));
        }

        // A record matching several comma-separated terms is returned once.
        return results
            .DistinctBy(r => (r.Type, r.SubEntryId, r.AppendId))
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToList();
    }

    private Task<List<SearchResultResponse>> SearchSubEntriesAsync(int userId, string term, bool caseSensitive)
    {
        var subEntries = db.JournalSubEntries.Where(s => s.JournalEntry!.UserId == userId);
        subEntries = caseSensitive
            ? subEntries.Where(s => s.Content.Contains(term))
            : subEntries.Where(s => s.Content.ToLower().Contains(term.ToLower()));

        return subEntries
            .Select(s => new SearchResultResponse(
                SearchResultType.SubEntry, s.Id, null, s.Category, s.Content, s.JournalEntry!.EntryDate, s.CreatedAtUtc))
            .ToListAsync();
    }

    private Task<List<SearchResultResponse>> SearchAppendsAsync(int userId, string term, bool caseSensitive)
    {
        var appends = db.JournalAppends.Where(a => a.JournalSubEntry!.JournalEntry!.UserId == userId);
        appends = caseSensitive
            ? appends.Where(a => a.Content.Contains(term))
            : appends.Where(a => a.Content.ToLower().Contains(term.ToLower()));

        return appends
            .Select(a => new SearchResultResponse(
                SearchResultType.Append,
                a.JournalSubEntryId,
                a.Id,
                a.JournalSubEntry!.Category,
                a.Content,
                a.JournalSubEntry.JournalEntry!.EntryDate,
                a.CreatedAtUtc))
            .ToListAsync();
    }
}
