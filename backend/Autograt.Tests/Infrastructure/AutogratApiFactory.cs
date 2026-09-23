using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace Autograt.Tests.Infrastructure;

/// <summary>
/// Hosts the API in-process against a throwaway SQLite file so tests never touch the real database.
/// </summary>
public class AutogratApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databasePath =
        Path.Combine(Path.GetTempPath(), $"autograt-test-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={_databasePath}");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        // Pooled connections keep the file locked on Windows until the pool is cleared.
        SqliteConnection.ClearAllPools();
        File.Delete(_databasePath);
    }
}
