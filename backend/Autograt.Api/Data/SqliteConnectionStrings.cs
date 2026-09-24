using Microsoft.Data.Sqlite;

namespace Autograt.Api.Data;

public static class SqliteConnectionStrings
{
    /// <summary>
    /// Resolves a relative <c>Data Source</c> against <paramref name="contentRootPath"/> and ensures its
    /// folder exists, since SQLite creates the database file but not missing directories.
    /// </summary>
    public static string ResolveDataSource(string connectionString, string contentRootPath)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (builder.DataSource == ":memory:")
        {
            return connectionString;
        }

        builder.DataSource = Path.GetFullPath(builder.DataSource, contentRootPath);
        Directory.CreateDirectory(Path.GetDirectoryName(builder.DataSource)!);
        return builder.ToString();
    }

    /// <summary>
    /// The folder holding the database file, where other persistent files (such as the JWT key) also live.
    /// </summary>
    public static string GetDataDirectory(string connectionString, string contentRootPath)
    {
        var dataSource = new SqliteConnectionStringBuilder(connectionString).DataSource;
        return dataSource == ":memory:"
            ? Path.Combine(contentRootPath, "data")
            : Path.GetDirectoryName(Path.GetFullPath(dataSource, contentRootPath))!;
    }
}
