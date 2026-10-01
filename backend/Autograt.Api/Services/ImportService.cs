using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>A problem with an imported file, keyed by the JSON path of the value it is about.</summary>
public sealed record ImportProblem(string Field, string Message);

/// <summary>
/// Imports a <see cref="JournalExport"/> into a user's account. The file wins: each day in it replaces the
/// user's day on that date, days not in the file are left untouched, and each setting in it replaces the
/// user's saved values. Unlike normal editing, past days can be written, and the file's timestamps are kept.
/// </summary>
public class ImportService(AutogratDbContext db, TimeProvider timeProvider)
{
    /// <summary>
    /// Checks the rules data annotations can't express. The file must already have passed annotation validation.
    /// </summary>
    /// <returns>Every problem found, or an empty list when the file can be imported.</returns>
    public List<ImportProblem> Validate(JournalExport file)
    {
        var problems = new List<ImportProblem>();

        if (file.Format != JournalExport.FormatName)
        {
            problems.Add(new("format", $"This is not an Autograt export; expected format '{JournalExport.FormatName}'."));
        }

        if (file.Version != JournalExport.CurrentVersion)
        {
            problems.Add(new("version", $"Version {file.Version} is not supported; this server imports version {JournalExport.CurrentVersion}."));
        }

        var now = timeProvider.GetUtcNow();
        var seenDates = new HashSet<DateOnly>();
        for (var i = 0; i < file.Entries.Count; i++)
        {
            var date = file.Entries[i].Date!.Value;
            if (seenDates.Add(date) == false)
            {
                problems.Add(new($"entries[{i}].date", $"{date:yyyy-MM-dd} appears more than once."));
            }
            else if (JournalDates.IsFuture(date, now))
            {
                problems.Add(new($"entries[{i}].date", $"{date:yyyy-MM-dd} is in the future."));
            }
        }

        var seenSettings = new HashSet<Setting>();
        for (var i = 0; i < file.Settings.Count; i++)
        {
            var setting = file.Settings[i].Setting!.Value;
            var error = seenSettings.Add(setting)
                ? SettingDefinitions.For(setting).Validate(file.Settings[i].Values)
                : $"{setting} appears more than once.";
            if (error is not null)
            {
                problems.Add(new($"settings[{i}].values", $"{setting}: {error}"));
            }
        }

        return problems;
    }

    /// <summary>Imports a file that passed <see cref="Validate"/>, all or nothing.</summary>
    public async Task<ImportResponse> ImportAsync(int userId, JournalExport file)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();

        var dates = file.Entries.Select(e => e.Date!.Value).ToList();
        var replaced = await db.JournalEntries
            .Where(e => e.UserId == userId && dates.Contains(e.EntryDate))
            .OrderBy(e => e.EntryDate)
            .ToListAsync();
        // The database cascades the delete to the days' sub-entries and appends.
        db.JournalEntries.RemoveRange(replaced);

        var settings = file.Settings.Select(s => s.Setting!.Value).ToList();
        db.UserSettings.RemoveRange(
            await db.UserSettings.Where(s => s.UserId == userId && settings.Contains(s.Setting)).ToListAsync());

        // Saved before adding, so a replaced day's date is free for the unique (user, date) index.
        await db.SaveChangesAsync();

        db.JournalEntries.AddRange(file.Entries.Select(day => ToEntity(userId, day)));
        db.UserSettings.AddRange(file.Settings.SelectMany(s => s.Values.Select(value =>
            new UserSetting { UserId = userId, Setting = s.Setting!.Value, Value = value })));
        await db.SaveChangesAsync();

        await transaction.CommitAsync();

        return new ImportResponse(file.Entries.Count, replaced.Select(e => e.EntryDate).ToList(), file.Settings.Count);
    }

    private static JournalEntry ToEntity(int userId, ExportedDay day)
    {
        var entry = new JournalEntry
        {
            UserId = userId,
            EntryDate = day.Date!.Value,
            DayRating = day.Rating,
            CreatedAtUtc = ToUtc(day.CreatedAtUtc!.Value),
        };

        foreach (var subEntry in day.SubEntries)
        {
            var newSubEntry = new JournalSubEntry
            {
                Category = subEntry.Category!.Value,
                Content = subEntry.Content.Trim(),
                CreatedAtUtc = ToUtc(subEntry.CreatedAtUtc!.Value),
            };
            newSubEntry.Appends.AddRange(subEntry.Appends.Select(append => new JournalAppend
            {
                Content = append.Content.Trim(),
                CreatedAtUtc = ToUtc(append.CreatedAtUtc!.Value),
            }));
            entry.SubEntries.Add(newSubEntry);
        }

        return entry;
    }

    /// <summary>Times with an offset are converted to UTC; times without one are taken to be UTC already.</summary>
    private static DateTime ToUtc(DateTime time) => time.Kind == DateTimeKind.Local
        ? time.ToUniversalTime()
        : DateTime.SpecifyKind(time, DateTimeKind.Utc);
}
