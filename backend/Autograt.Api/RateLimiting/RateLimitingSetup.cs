using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Autograt.Api.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Autograt.Api.RateLimiting;

public static class RateLimitingSetup
{
    /// <summary>Endpoint policy for login and register, which are open to password guessing.</summary>
    public const string AuthPolicy = "auth";

    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Limits every request per signed-in user, or per client IP when anonymous, and adds the stricter
    /// <see cref="AuthPolicy"/> for endpoints that opt in.
    /// </summary>
    public static IServiceCollection AddAutogratRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RateLimitingOptions>(configuration.GetSection(RateLimitingOptions.SectionName));

        services.AddRateLimiter(options =>
        {
            options.OnRejected = WriteRejectionAsync;

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                var limits = GetLimits(context);
                var userId = context.User.FindFirstValue(AuthClaims.UserId);
                return userId is null
                    ? FixedWindow($"ip:{context.GetClientIp()}", limits.AnonymousPermitsPerMinute)
                    : FixedWindow($"user:{userId}", limits.UserPermitsPerMinute);
            });

            options.AddPolicy(AuthPolicy, context =>
                FixedWindow(context.GetClientIp(), GetLimits(context).AuthPermitsPerMinute));
        });

        return services;
    }

    private static RateLimitPartition<string> FixedWindow(string key, int permitLimit) =>
        RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit,
            Window = Window,
            QueueLimit = 0,
        });

    // Read per request so configuration overrides (e.g. in tests) apply.
    private static RateLimitingOptions GetLimits(HttpContext context) =>
        context.RequestServices.GetRequiredService<IOptions<RateLimitingOptions>>().Value;

    private static async ValueTask WriteRejectionAsync(OnRejectedContext context, CancellationToken cancellationToken)
    {
        var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var delay) ? delay : Window;
        var seconds = (int)Math.Ceiling(retryAfter.TotalSeconds);

        var request = context.HttpContext.Request;
        context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(RateLimitingSetup))
            .LogWarning("Rate limited {Method} {Path} from {ClientIp}.", request.Method, request.Path, context.HttpContext.GetClientIp());

        var response = context.HttpContext.Response;
        response.StatusCode = StatusCodes.Status429TooManyRequests;
        response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = $"Too many requests. Try again in {seconds} seconds.",
        };
        await response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json", cancellationToken);
    }
}
