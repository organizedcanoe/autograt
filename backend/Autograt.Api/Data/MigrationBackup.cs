using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Data;

/// <summary>
/// Copies the database before pending migrations run, since migrations only go forward and a failed or
/// unwanted one can't otherwise be undone.
/// </summary>
public static class MigrationBackup
{
    public const string BackupFolderName = "backups";
    public const int BackupsToKeep = 5;

    private const string BackupFilePattern = "autograt-*.db";

    /// <summary>
    /// Backs up an existing database that has migrations pending, then deletes all but the newest
    /// <see cref="BackupsToKeep"/> backups. Returns the backup's path, or null when nothing needed backing up.
    /// </summary>
    public static async Task<string?> BackupIfMigratingAsync(AutogratDbContext db)
    {
        var databasePath = new SqliteConnectionStringBuilder(db.Database.GetConnectionString()).DataSource;
        // Checked first, because asking SQLite about migrations would create an empty file.
        if (!File.Exists(databasePath))
        {
            return null;
        }

        var applied = await db.Database.GetAppliedMigrationsAsync();
        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
        if (!applied.Any() || pending.Count == 0)
        {
            return null;
        }

        var backupDirectory = Path.Combine(Path.GetDirectoryName(databasePath)!, BackupFolderName);
        Directory.CreateDirectory(backupDirectory);
        var backupPath = Path.Combine(backupDirectory, $"autograt-{DateTime.UtcNow:yyyyMMdd-HHmmss}-before-{pending[^1]}.db");

        // SQLite's online backup copies a consistent snapshot, including changes still in the WAL file.
        await using (var source = new SqliteConnection($"Data Source={databasePath};Mode=ReadOnly;Pooling=False"))
        await using (var destination = new SqliteConnection($"Data Source={backupPath};Pooling=False"))
        {
            await source.OpenAsync();
            await destination.OpenAsync();
            source.BackupDatabase(destination);
        }

        DeleteOldBackups(backupDirectory);
        return backupPath;
    }

    private static void DeleteOldBackups(string backupDirectory)
    {
        // File names start with a sortable UTC timestamp, so name order is age order.
        var oldBackups = Directory.GetFiles(backupDirectory, BackupFilePattern)
            .OrderByDescending(Path.GetFileName, StringComparer.Ordinal)
            .Skip(BackupsToKeep);
        foreach (var backup in oldBackups)
        {
            File.Delete(backup);
        }
    }
}
