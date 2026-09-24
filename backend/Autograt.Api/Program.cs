using System.Text.Json.Serialization;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var bearer = new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
    };
    options.AddSecurityDefinition("Bearer", bearer);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [bearer] = [] });
});

// Settings below are read when services are first resolved, so test overrides of configuration apply.
builder.Services.AddDbContext<AutogratDbContext>((services, options) =>
{
    var connectionString = GetConnectionString(services.GetRequiredService<IConfiguration>());
    var contentRoot = services.GetRequiredService<IWebHostEnvironment>().ContentRootPath;
    options.UseSqlite(SqliteConnectionStrings.ResolveDataSource(connectionString, contentRoot));
});

builder.Services.AddSingleton(services =>
{
    var configuration = services.GetRequiredService<IConfiguration>();
    var contentRoot = services.GetRequiredService<IWebHostEnvironment>().ContentRootPath;
    var dataDirectory = SqliteConnectionStrings.GetDataDirectory(GetConnectionString(configuration), contentRoot);
    var key = JwtKeyProvider.GetOrCreateKey(configuration["Jwt:Key"], dataDirectory);
    return new JwtSigningKey(new SymmetricSecurityKey(key));
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<JwtSigningKey>((options, signingKey) =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = TokenService.CreateValidationParameters(signingKey);
    });

// Every endpoint requires a signed-in user unless it opts out with [AllowAnonymous].
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<JournalService>();
builder.Services.AddScoped<SearchService>();
builder.Services.AddSingleton<TokenService>();

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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

await app.RunAsync();

static string GetConnectionString(IConfiguration configuration) =>
    configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

// Exposes the implicit Program class to WebApplicationFactory in integration tests.
public partial class Program { }
