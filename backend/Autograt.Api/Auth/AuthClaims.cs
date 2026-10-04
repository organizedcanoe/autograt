using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Autograt.Api.Auth;

/// <summary>
/// Claim names used in Autograt tokens. Inbound claim mapping is disabled, so these names are read as-is.
/// </summary>
public static class AuthClaims
{
    public const string UserId = JwtRegisteredClaimNames.Sub;
    public const string Username = "name";
    public const string Role = "role";
    public const string SecurityStamp = "stamp";
    public const string AuthTime = JwtRegisteredClaimNames.AuthTime;
    public const string AdminRole = "Admin";

    /// <summary>The authenticated user's ID. Only valid on endpoints that require authentication.</summary>
    public static int GetUserId(this ClaimsPrincipal principal) =>
        int.Parse(principal.FindFirstValue(UserId)
            ?? throw new InvalidOperationException("The user is not authenticated."));

    /// <summary>When the session's user logged in, or null for tokens issued before this claim existed.</summary>
    public static DateTime? GetAuthTimeUtc(this ClaimsPrincipal principal) =>
        long.TryParse(principal.FindFirstValue(AuthTime), out var seconds)
            ? DateTimeOffset.FromUnixTimeSeconds(seconds).UtcDateTime
            : null;
}
