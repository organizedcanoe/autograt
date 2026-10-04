namespace Autograt.Api.Auth;

/// <summary>Helpers for logging security events: logins, account changes and admin actions.</summary>
public static class SecurityLogging
{
    private const int VisibleUsernameCharacters = 3;

    /// <summary>The client's IP. Behind the proxy this is the forwarded address (see UseForwardedHeaders in Program.cs).</summary>
    public static string GetClientIp(this HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    /// <summary>
    /// The first three characters of a username followed by "***", for failed logins: people sometimes type their
    /// password into the username field. The stars don't vary, so the length isn't revealed either.
    /// </summary>
    public static string MaskUsername(string username)
    {
        username = username.Trim();
        return $"{username[..Math.Min(VisibleUsernameCharacters, username.Length)]}***";
    }
}
