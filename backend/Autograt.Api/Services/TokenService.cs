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

    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    public (string Token, DateTime ExpiresAtUtc) CreateToken(User user)
    {
        var expiresAtUtc = DateTime.UtcNow.Add(Lifetime);
        var claims = new List<Claim>
        {
            new(AuthClaims.UserId, user.Id.ToString()),
            new(AuthClaims.Username, user.Username),
        };
        if (user.Role == UserRole.Admin)
        {
            claims.Add(new Claim(AuthClaims.Role, AuthClaims.AdminRole));
        }

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
