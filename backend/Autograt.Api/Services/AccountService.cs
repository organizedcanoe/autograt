using System.Security.Cryptography;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>Changes to a user's own account, and admin password resets.</summary>
public class AccountService(AutogratDbContext db, AuthService authService, IPasswordHasher<User> passwordHasher)
{
    // No 0/O or 1/l/I, so a temporary password can be read out or typed by hand.
    private const string TemporaryPasswordAlphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int TemporaryPasswordLength = 12;

    /// <summary>Sets a new password and ends every other session. Fails with WrongPassword when the current password is wrong.</summary>
    public async Task<ServiceResult<User>> ChangePasswordAsync(int userId, string currentPassword, string newPassword)
    {
        var result = await FindVerifiedAsync(userId, currentPassword);
        if (result.IsSuccess)
        {
            SetPassword(result.Value, newPassword);
            result.Value.MustChangePassword = false;
            await db.SaveChangesAsync();
        }

        return result;
    }

    /// <summary>Renames the user. Usernames are unique ignoring case, but a user may change the case of their own.</summary>
    public async Task<ServiceResult<User>> ChangeUsernameAsync(int userId, string username)
    {
        username = username.Trim();
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return ServiceResult<User>.Failure(ServiceError.NotFound);
        }

        if (await db.Users.AnyAsync(u => u.Username == username && u.Id != userId))
        {
            return ServiceResult<User>.Conflict();
        }

        user.Username = username;
        await db.SaveChangesAsync();
        return ServiceResult<User>.Success(user);
    }

    /// <summary>
    /// Deletes the user and, through cascades, all their journal data, settings and push subscriptions.
    /// Fails with InvalidState when the user is the last admin and other users would be left without one.
    /// </summary>
    public async Task<ServiceResult<User>> DeleteAsync(int userId, string password)
    {
        var result = await FindVerifiedAsync(userId, password);
        if (result.IsSuccess == false)
        {
            return result;
        }

        if (await IsLastAdminWithOtherUsersAsync(result.Value))
        {
            return ServiceResult<User>.Failure(ServiceError.InvalidState);
        }

        db.Users.Remove(result.Value);
        await db.SaveChangesAsync();
        return result;
    }

    /// <summary>
    /// Gives an approved user a random temporary password, ends their sessions, and asks them to choose a new
    /// password after logging in. Fails with InvalidState when the user is pending.
    /// </summary>
    /// <returns>The temporary password, which is not stored anywhere in plain text.</returns>
    public async Task<ServiceResult<string>> ResetPasswordAsync(int userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return ServiceResult<string>.Failure(ServiceError.NotFound);
        }

        if (user.Role == UserRole.Pending)
        {
            return ServiceResult<string>.Failure(ServiceError.InvalidState);
        }

        var temporaryPassword = RandomNumberGenerator.GetString(TemporaryPasswordAlphabet, TemporaryPasswordLength);
        SetPassword(user, temporaryPassword);
        user.MustChangePassword = true;
        await db.SaveChangesAsync();
        return ServiceResult<string>.Success(temporaryPassword);
    }

    private async Task<ServiceResult<User>> FindVerifiedAsync(int userId, string password)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return ServiceResult<User>.Failure(ServiceError.NotFound);
        }

        return await authService.VerifyPasswordAsync(user, password)
            ? ServiceResult<User>.Success(user)
            : ServiceResult<User>.Failure(ServiceError.WrongPassword);
    }

    private async Task<bool> IsLastAdminWithOtherUsersAsync(User user) =>
        user.Role == UserRole.Admin
        && await db.Users.AnyAsync(u => u.Role == UserRole.Admin && u.Id != user.Id) == false
        && await db.Users.AnyAsync(u => u.Id != user.Id);

    /// <summary>Replaces the password hash and the security stamp, so tokens issued before stop working.</summary>
    private void SetPassword(User user, string password)
    {
        user.PasswordHash = passwordHasher.HashPassword(user, password);
        user.SecurityStamp = User.NewSecurityStamp();
    }
}
