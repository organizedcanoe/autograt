using Autograt.Api.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Tests.Infrastructure;

/// <summary>
/// An in-memory SQLite database with the real migrations applied. The database lives as long as this
/// instance keeps its connection open, so each test class instance gets a fresh, isolated schema.
/// </summary>
public sealed class SqliteTestDatabase : IDisposable
{
    private readonly DbContextOptions<AutogratDbContext> _options;

    public SqliteTestDatabase()
    {
        Connection = new SqliteConnection("Data Source=:memory:");
        Connection.Open();

        _options = new DbContextOptionsBuilder<AutogratDbContext>()
            .UseSqlite(Connection)
            .Options;

        using var context = CreateContext();
        context.Database.Migrate();
    }

    public SqliteConnection Connection { get; }

    public AutogratDbContext CreateContext() => new(_options);

    public void Dispose() => Connection.Dispose();
}
