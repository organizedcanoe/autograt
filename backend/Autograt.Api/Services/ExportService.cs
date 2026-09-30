using System.Text;
using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>Exports one user's journal and saved settings, as re-importable JSON or readable Markdown.</summary>
public class ExportService(AutogratDbContext db, TimeProvider timeProvider)
{
    /// <returns>The user's export, or null if the user does not exist.</returns>
    public async Task<JournalExport?> BuildAsync(int userId)
    {
        var username = await db.Users.Where(u => u.Id == userId).Select(u => u.Username).SingleOrDefaultAsync();
        if (username is null)
        {
            return null;
        }

        var settings = await db.UserSettings.AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Id)
            .ToListAsync();

        var entries = await db.JournalEntries.AsNoTracking()
            .Include(e => e.SubEntries)
            .ThenInclude(s => s.Appends)
            .Where(e => e.UserId == userId)
            .OrderBy(e => e.EntryDate)
            .ToListAsync();

        return new JournalExport
        {
            Format = JournalExport.FormatName,
            Version = JournalExport.CurrentVersion,
            ExportedAtUtc = timeProvider.GetUtcNow().UtcDateTime,
            Username = username,
            Settings = settings
                .GroupBy(s => s.Setting)
                .OrderBy(g => g.Key)
                .Select(g => new ExportedSetting { Setting = g.Key, Values = g.Select(s => s.Value).ToList() })
                .ToList(),
            Entries = entries.Select(e => new ExportedDay
            {
                Date = e.EntryDate,
                Rating = e.DayRating,
                CreatedAtUtc = e.CreatedAtUtc,
                SubEntries = e.SubEntries.OrderBy(s => s.CreatedAtUtc).ThenBy(s => s.Id).Select(s => new ExportedSubEntry
                {
                    Category = s.Category,
                    Content = s.Content,
                    CreatedAtUtc = s.CreatedAtUtc,
                    Appends = s.Appends.OrderBy(a => a.CreatedAtUtc).ThenBy(a => a.Id).Select(a => new ExportedAppend
                    {
                        Content = a.Content,
                        CreatedAtUtc = a.CreatedAtUtc,
                    }).ToList(),
                }).ToList(),
            }).ToList(),
        };
    }

    /// <summary>Renders an export for reading or printing, newest day first. It cannot be imported.</summary>
    public static string ToMarkdown(JournalExport export)
    {
        var markdown = new StringBuilder()
            .Append($"# Autograt journal: {export.Username}\n")
            .Append($"Exported {export.ExportedAtUtc:yyyy-MM-dd}\n");

        foreach (var day in export.Entries.OrderByDescending(e => e.Date))
        {
            var rating = day.Rating is null ? "unrated" : $"rating {day.Rating}/10";
            markdown.Append($"\n## {day.Date:yyyy-MM-dd} ({rating})\n");

            foreach (var subEntry in day.SubEntries)
            {
                markdown.Append($"- **{subEntry.Category}:** {Indent(subEntry.Content, 2)}\n");
                foreach (var append in subEntry.Appends)
                {
                    markdown.Append($"  - _Added {append.CreatedAtUtc:yyyy-MM-dd}:_ {Indent(append.Content, 4)}\n");
                }
            }
        }

        return markdown.ToString();
    }

    /// <summary>Indents the lines after the first, so multi-line content stays inside its list item.</summary>
    private static string Indent(string content, int spaces) =>
        content.ReplaceLineEndings("\n").Replace("\n", "\n" + new string(' ', spaces));
}
