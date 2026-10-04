using System.Security.Claims;
using Autograt.Api.Auth;
using Autograt.Api.Models;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Autograt.Api.Services;

public class TokenService(JwtSigningKey signingKey)
{
    public const string Issuer = "autograt";
    public const string Audience = "autograt";

    // Clients refresh the token while in use (POST /api/auth/refresh), so this is how long a session survives unused.
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);

    /// <summary>How long after logging in a session can be refreshed; then the user must log in again.</summary>
    public static readonly TimeSpan MaxSessionAge = TimeSpan.FromDays(90);

    /// <summary>Creates a token for a user who has just logged in.</summary>
    public (string Token, DateTime ExpiresAtUtc) CreateToken(User user) => CreateToken(user, DateTime.UtcNow);

    /// <param name="authTimeUtc">When the user logged in. The token never outlives <see cref="MaxSessionAge"/> from it.</param>
    public (string Token, DateTime ExpiresAtUtc) CreateToken(User user, DateTime authTimeUtc)
    {
        var sessionEndUtc = authTimeUtc.Add(MaxSessionAge);
        var expiresAtUtc = DateTime.UtcNow.Add(Lifetime);
        if (expiresAtUtc > sessionEndUtc)
        {
            expiresAtUtc = sessionEndUtc;
        }

        var claims = new List<Claim>
        {
            new(AuthClaims.UserId, user.Id.ToString()),
            new(AuthClaims.Username, user.Username),
            new(AuthClaims.SecurityStamp, user.SecurityStamp),
            new(AuthClaims.AuthTime, EpochTime.GetIntDate(authTimeUtc).ToString(), ClaimValueTypes.Integer64),
        };
        // No role claim: SessionValidator adds it from the database on each request, so role changes apply at once.

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = Issuer,
            Audience = Audience,
            Expires = expiresAtUtc,
            SigningCredentials = new SigningCredentials(signingKey.Key, SecurityAlgorithms.HmacSha256),
        });

        return (token, expiresAtUtc);
    }

    public static TokenValidationParameters CreateValidationParameters(JwtSigningKey signingKey) => new()
    {
        ValidIssuer = Issuer,
        ValidAudience = Audience,
        IssuerSigningKey = signingKey.Key,
        NameClaimType = AuthClaims.Username,
        RoleClaimType = AuthClaims.Role,
    };
}

public sealed record JwtSigningKey(SymmetricSecurityKey Key);
