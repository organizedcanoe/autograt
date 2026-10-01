using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

public class AuthService(AutogratDbContext db, IPasswordHasher<User> passwordHasher, AppSettingsService appSettingsService)
{
    /// <summary>
    /// Creates a user. The very first user becomes the admin; later users are pending until an admin approves them.
    /// Usernames are unique, ignoring case. Fails with InvalidState when an admin has closed registration.
    /// </summary>
    public async Task<ServiceResult<User>> RegisterAsync(string username, string password)
    {
        if (await IsRegistrationOpenAsync() == false)
        {
            return ServiceResult<User>.Failure(ServiceError.InvalidState);
        }

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
            Role = isFirstUser ? UserRole.Admin : UserRole.Pending,
        };
        user.PasswordHash = passwordHasher.HashPassword(user, password);

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return ServiceResult<User>.Success(user);
    }

    /// <summary>Whether anyone can register. The first user can always register, so a new install gets an admin.</summary>
    public async Task<bool> IsRegistrationOpenAsync() =>
        await db.Users.AnyAsync() == false || await appSettingsService.IsRegistrationOpenAsync();

    /// <returns>The user when the credentials are valid; otherwise null.</returns>
    public async Task<User?> ValidateCredentialsAsync(string username, string password)
    {
        username = username.Trim();
        var user = await db.Users.SingleOrDefaultAsync(u => u.Username == username);
        return user is not null && await VerifyPasswordAsync(user, password) ? user : null;
    }

    /// <summary>Checks a tracked user's password, upgrading the stored hash when the hashing settings have changed.</summary>
    public async Task<bool> VerifyPasswordAsync(User user, string password)
    {
        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, password);
            await db.SaveChangesAsync();
        }

        return result != PasswordVerificationResult.Failed;
    }
}
