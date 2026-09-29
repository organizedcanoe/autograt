namespace Autograt.Api.RateLimiting;

/// <summary>
/// Requests allowed per one-minute window, bound from the "RateLimiting" configuration section.
/// </summary>
public class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Login and register attempts per client IP.</summary>
    public int AuthPermitsPerMinute { get; set; } = 10;

    /// <summary>Any other anonymous request per client IP.</summary>
    public int AnonymousPermitsPerMinute { get; set; } = 60;

    /// <summary>Requests per signed-in user, wherever they come from.</summary>
    public int UserPermitsPerMinute { get; set; } = 300;
}
