using System.Security.Claims;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Auth;

/// <summary>
/// Rejects a token whose user no longer exists, can no longer log in, or whose security stamp has since been
/// replaced, so a password change, account deletion or disabling ends existing sessions straight away. The role
/// is read from the database rather than the token, so promotions and demotions apply on the next request.
/// </summary>
public static class SessionValidator
{
    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        var stamp = context.Principal?.FindFirst(AuthClaims.SecurityStamp)?.Value;
        if (stamp is null || int.TryParse(context.Principal!.FindFirst(AuthClaims.UserId)?.Value, out var userId) == false)
        {
            context.Fail("The token is missing its user or security stamp.");
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<AutogratDbContext>();
        var user = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.SecurityStamp, u.Role })
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        if (user is null || user.SecurityStamp != stamp || user.Role is UserRole.Pending or UserRole.Disabled)
        {
            context.Fail("The session has ended.");
            return;
        }

        var identity = (ClaimsIdentity)context.Principal.Identity!;
        foreach (var roleClaim in identity.FindAll(AuthClaims.Role).ToList())
        {
            identity.RemoveClaim(roleClaim);
        }

        if (user.Role == UserRole.Admin)
        {
            identity.AddClaim(new Claim(AuthClaims.Role, AuthClaims.AdminRole));
        }
    }
}
