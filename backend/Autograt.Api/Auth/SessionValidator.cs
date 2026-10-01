using Autograt.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Auth;

/// <summary>
/// Rejects a token whose user no longer exists or whose security stamp has since been replaced,
/// so a password change or account deletion ends existing sessions straight away.
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
        var currentStamp = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.SecurityStamp)
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        if (currentStamp != stamp)
        {
            context.Fail("The session has ended.");
        }
    }
}
