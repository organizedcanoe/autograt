using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

public class AuthService(AutogratDbContext db, IPasswordHasher<User> passwordHasher)
{
    /// <summary>
    /// Creates a user. The very first user becomes the admin. Usernames are unique, ignoring case.
    /// </summary>
    public async Task<ServiceResult<User>> RegisterAsync(string username, string password)
    {
        username = username.Trim();
        if (await db.Users.AnyAsync(u => u.Username == username))
        {
            return ServiceResult<User>.Conflict();
        }

        bool isFirstUser = await db.Users.AnyAsync() == false;

        var user = new User
        {
            Username = username,
            PasswordHash = "",
            IsAdmin = isFirstUser,
        };
        user.PasswordHash = passwordHasher.HashPassword(user, password);

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return ServiceResult<User>.Success(user);
    }

    /// <returns>The user when the credentials are valid; otherwise null.</returns>
    public async Task<User?> ValidateCredentialsAsync(string username, string password)
    {
        username = username.Trim();
        var user = await db.Users.SingleOrDefaultAsync(u => u.Username == username);
        if (user is null)
        {
            return null;
        }

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, password);
            await db.SaveChangesAsync();
        }

        return result == PasswordVerificationResult.Failed ? null : user;
    }
}
