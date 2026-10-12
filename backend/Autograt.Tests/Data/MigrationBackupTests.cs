using Autograt.Api.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Autograt.Tests.Data;

public class MigrationBackupTests : IDisposable
{
    private readonly string _dataDirectory =
        Path.Combine(Path.GetTempPath(), $"autograt-backup-{Guid.NewGuid():N}");

    public MigrationBackupTests() => Directory.CreateDirectory(_dataDirectory);

    private string DatabasePath => Path.Combine(_dataDirectory, "autograt.db");

    private string BackupDirectory => Path.Combine(_dataDirectory, MigrationBackup.BackupFolderName);

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_dataDirectory)) Directory.Delete(_dataDirectory, recursive: true);
    }

    [Fact]
    public async Task PendingMigrations_OnExistingDatabase_AreBackedUpFirst()
    {
        await using var context = CreateContext();
        var applied = await MigrateToFirstMigrationAsync(context);

        var backupPath = await MigrationBackup.BackupIfMigratingAsync(context);

        Assert.NotNull(backupPath);
        Assert.Equal(BackupDirectory, Path.GetDirectoryName(backupPath));
        var lastPending = context.Database.GetMigrations().Last();
        Assert.EndsWith($"-before-{lastPending}.db", backupPath);
        Assert.Equal([applied], ReadAppliedMigrations(backupPath));
    }

    [Fact]
    public async Task NewDatabase_IsNotBackedUp()
    {
        await using var context = CreateContext();

        var backupPath = await MigrationBackup.BackupIfMigratingAsync(context);

        Assert.Null(backupPath);
        Assert.False(Directory.Exists(BackupDirectory));
    }

    [Fact]
    public async Task UpToDateDatabase_IsNotBackedUp()
    {
        await using var context = CreateContext();
        await context.Database.MigrateAsync();

        var backupPath = await MigrationBackup.BackupIfMigratingAsync(context);

        Assert.Null(backupPath);
        Assert.False(Directory.Exists(BackupDirectory));
    }

    [Fact]
    public async Task OnlyTheNewestBackupsAreKept()
    {
        Directory.CreateDirectory(BackupDirectory);
        var oldBackups = Enumerable.Range(1, MigrationBackup.BackupsToKeep)
            .Select(day => Path.Combine(BackupDirectory, $"autograt-202601{day:00}-000000-before-Old.db"))
            .ToList();
        oldBackups.ForEach(path => File.WriteAllText(path, ""));
        var unrelatedFile = Path.Combine(BackupDirectory, "notes.txt");
        File.WriteAllText(unrelatedFile, "");

        await using var context = CreateContext();
        await MigrateToFirstMigrationAsync(context);

        var backupPath = await MigrationBackup.BackupIfMigratingAsync(context);

        var kept = Directory.GetFiles(BackupDirectory, "autograt-*.db");
        Assert.Equal(MigrationBackup.BackupsToKeep, kept.Length);
        Assert.Contains(backupPath, kept);
        Assert.DoesNotContain(oldBackups[0], kept);
        Assert.True(File.Exists(unrelatedFile));
    }

    private AutogratDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AutogratDbContext>().UseSqlite($"Data Source={DatabasePath}").Options);

    private static async Task<string> MigrateToFirstMigrationAsync(AutogratDbContext context)
    {
        var first = context.Database.GetMigrations().First();
        await context.GetService<IMigrator>().MigrateAsync(first);
        return first;
    }

    private static List<string> ReadAppliedMigrations(string databasePath)
    {
        using var connection = new SqliteConnection($"Data Source={databasePath};Mode=ReadOnly;Pooling=False");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT MigrationId FROM __EFMigrationsHistory";
        using var reader = command.ExecuteReader();
        var migrations = new List<string>();
        while (reader.Read()) migrations.Add(reader.GetString(0));
        return migrations;
    }
}
