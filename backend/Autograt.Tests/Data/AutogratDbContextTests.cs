using Autograt.Api.Models;
using Autograt.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Tests.Data;

public class AutogratDbContextTests : IDisposable
{
    private static readonly DateOnly Today = new(2026, 9, 23);

    private readonly SqliteTestDatabase _database = new();

    public void Dispose() => _database.Dispose();

    [Fact]
    public void Migrations_CreateAllTables()
    {
        using var command = _database.Connection.CreateCommand();
        command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table'";
        var tables = new List<string>();
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read()) tables.Add(reader.GetString(0));
        }

        Assert.Contains("User", tables);
        Assert.Contains("JournalEntry", tables);
        Assert.Contains("JournalSubEntry", tables);
        Assert.Contains("JournalAppend", tables);
    }

    [Fact]
    public async Task User_IdIsGeneratedAndIsAdminDefaultsToFalse()
    {
        var user = await AddUserAsync("billy");

        await using var context = _database.CreateContext();
        var saved = await context.Users.SingleAsync();
        Assert.True(user.Id > 0);
        Assert.Equal(user.Id, saved.Id);
        Assert.False(saved.IsAdmin);
    }

    [Theory]
    [InlineData("billy")]
    [InlineData("BILLY")]
    public async Task User_DuplicateUsername_IsRejectedCaseInsensitively(string duplicateUsername)
    {
        await AddUserAsync("billy");

        await Assert.ThrowsAsync<DbUpdateException>(() => AddUserAsync(duplicateUsername));
    }

    [Fact]
    public async Task JournalEntry_SecondEntryForSameUserAndDate_IsRejected()
    {
        var user = await AddUserAsync("billy");
        await AddEntryAsync(user.Id, Today, dayRating: 5);

        await Assert.ThrowsAsync<DbUpdateException>(() => AddEntryAsync(user.Id, Today, dayRating: 7));
    }

    [Fact]
    public async Task JournalEntry_SameDateForDifferentUsers_IsAllowed()
    {
        var first = await AddUserAsync("billy");
        var second = await AddUserAsync("alex");

        await AddEntryAsync(first.Id, Today, dayRating: 5);
        await AddEntryAsync(second.Id, Today, dayRating: 7);

        await using var context = _database.CreateContext();
        Assert.Equal(2, await context.JournalEntries.CountAsync());
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(11)]
    public async Task JournalEntry_DayRatingOutOfRange_IsRejected(int dayRating)
    {
        var user = await AddUserAsync("billy");

        await Assert.ThrowsAsync<DbUpdateException>(() => AddEntryAsync(user.Id, Today, dayRating));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(10)]
    public async Task JournalEntry_DayRatingAtBoundary_IsAccepted(int dayRating)
    {
        var user = await AddUserAsync("billy");

        await AddEntryAsync(user.Id, Today, dayRating);

        await using var context = _database.CreateContext();
        Assert.Equal(dayRating, (await context.JournalEntries.SingleAsync()).DayRating);
    }

    [Fact]
    public async Task JournalHierarchy_RoundTripsWithCategoryAndAppends()
    {
        var user = await AddUserAsync("billy");
        await using (var context = _database.CreateContext())
        {
            context.JournalEntries.Add(new JournalEntry
            {
                UserId = user.Id,
                EntryDate = Today,
                DayRating = 8,
                SubEntries =
                {
                    new JournalSubEntry
                    {
                        Category = EntryCategory.Good,
                        Content = "Walked the dog",
                        Appends = { new JournalAppend { Content = "It rained later" } },
                    },
                    new JournalSubEntry { Category = EntryCategory.Bad, Content = "Missed the bus" },
                },
            });
            await context.SaveChangesAsync();
        }

        await using var readContext = _database.CreateContext();
        var entry = await readContext.JournalEntries
            .Include(e => e.SubEntries)
            .ThenInclude(s => s.Appends)
            .SingleAsync();

        Assert.Equal(Today, entry.EntryDate);
        var good = Assert.Single(entry.SubEntries, s => s.Category == EntryCategory.Good);
        Assert.Equal("It rained later", Assert.Single(good.Appends).Content);
        Assert.Single(entry.SubEntries, s => s.Category == EntryCategory.Bad);
    }

    [Fact]
    public async Task SaveChanges_StampsCreatedAtUtc_AndReadsBackAsUtc()
    {
        var before = DateTime.UtcNow;
        var user = await AddUserAsync("billy");
        await AddEntryAsync(user.Id, Today, dayRating: 5);
        var after = DateTime.UtcNow;

        await using var context = _database.CreateContext();
        var savedUser = await context.Users.SingleAsync();
        var savedEntry = await context.JournalEntries.SingleAsync();

        Assert.Equal(DateTimeKind.Utc, savedUser.CreatedAtUtc.Kind);
        Assert.InRange(savedUser.CreatedAtUtc, before, after);
        Assert.InRange(savedEntry.CreatedAtUtc, before, after);
    }

    [Fact]
    public async Task DeletingUser_CascadesToEntriesSubEntriesAndAppends()
    {
        var user = await AddUserAsync("billy");
        await using (var context = _database.CreateContext())
        {
            context.JournalEntries.Add(new JournalEntry
            {
                UserId = user.Id,
                EntryDate = Today,
                DayRating = 5,
                SubEntries =
                {
                    new JournalSubEntry
                    {
                        Category = EntryCategory.Neutral,
                        Content = "Ordinary day",
                        Appends = { new JournalAppend { Content = "Still ordinary" } },
                    },
                },
            });
            await context.SaveChangesAsync();
        }

        // ExecuteDelete bypasses EF's change tracker, so this checks the database's own cascade rules.
        await using (var context = _database.CreateContext())
        {
            await context.Users.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
        }

        await using var readContext = _database.CreateContext();
        Assert.Equal(0, await readContext.JournalEntries.CountAsync());
        Assert.Equal(0, await readContext.JournalSubEntries.CountAsync());
        Assert.Equal(0, await readContext.JournalAppends.CountAsync());
    }

    private async Task<User> AddUserAsync(string username)
    {
        await using var context = _database.CreateContext();
        var user = new User { Username = username, PasswordHash = "hash" };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }

    private async Task AddEntryAsync(int userId, DateOnly entryDate, int dayRating)
    {
        await using var context = _database.CreateContext();
        context.JournalEntries.Add(new JournalEntry { UserId = userId, EntryDate = entryDate, DayRating = dayRating });
        await context.SaveChangesAsync();
    }
}
