using Autograt.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configuration is read when the context is first resolved, so test overrides of the connection string apply.
builder.Services.AddDbContext<AutogratDbContext>((services, options) =>
{
    var configuration = services.GetRequiredService<IConfiguration>();
    var environment = services.GetRequiredService<IWebHostEnvironment>();
    var connectionString = configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

    options.UseSqlite(SqliteConnectionStrings.ResolveDataSource(connectionString, environment.ContentRootPath));
});

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AutogratDbContext>();
    await db.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthorization();

app.MapControllers();

await app.RunAsync();

// Exposes the implicit Program class to WebApplicationFactory in integration tests.
public partial class Program { }
