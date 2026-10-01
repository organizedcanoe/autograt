using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

public class UserService(AutogratDbContext db)
{
    public Task<User?> FindAsync(int userId) =>
        db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId);

    public Task<List<User>> ListAsync() =>
        db.Users.AsNoTracking().OrderBy(u => u.Id).ToListAsync();

    /// <summary>Lets a pending user log in. Fails with InvalidState when the user is not pending.</summary>
    public Task<ServiceResult<User>> ApproveAsync(int userId) =>
        ChangeRoleAsync(userId, from: UserRole.Pending, to: UserRole.Standard);

    /// <summary>Makes a standard user an admin. Fails with InvalidState when the user is not a standard user.</summary>
    public Task<ServiceResult<User>> PromoteToAdminAsync(int userId) =>
        ChangeRoleAsync(userId, from: UserRole.Standard, to: UserRole.Admin);

    /// <summary>
    /// Makes an admin a standard user. Fails with InvalidState when the user is not an admin, or is the last admin.
    /// </summary>
    public async Task<ServiceResult<User>> DemoteToStandardAsync(int userId)
    {
        var result = await FindWithRoleAsync(userId, UserRole.Admin);
        if (result.IsSuccess == false)
        {
            return result;
        }

        if (await db.Users.AnyAsync(u => u.Role == UserRole.Admin && u.Id != userId) == false)
        {
            return ServiceResult<User>.Failure(ServiceError.InvalidState);
        }

        result.Value.Role = UserRole.Standard;
        await db.SaveChangesAsync();
        return result;
    }

    /// <summary>
    /// Stops a standard user logging in and ends their sessions, keeping their data. Admins must be demoted first.
    /// Fails with InvalidState when the user is not a standard user.
    /// </summary>
    public async Task<ServiceResult<User>> DisableAsync(int userId)
    {
        var result = await FindWithRoleAsync(userId, UserRole.Standard);
        if (result.IsSuccess)
        {
            result.Value.Role = UserRole.Disabled;
            // Sessions are already rejected while disabled; a new stamp keeps them dead after re-enabling.
            result.Value.SecurityStamp = User.NewSecurityStamp();
            await db.SaveChangesAsync();
        }

        return result;
    }

    /// <summary>Lets a disabled user log in again as a standard user. Fails with InvalidState when the user is not disabled.</summary>
    public Task<ServiceResult<User>> EnableAsync(int userId) =>
        ChangeRoleAsync(userId, from: UserRole.Disabled, to: UserRole.Standard);

    /// <summary>
    /// Deletes a non-admin user and, through cascades, all their journal data, settings and push subscriptions.
    /// Fails with InvalidState when the user is an admin; admins must be demoted first.
    /// </summary>
    public async Task<ServiceResult<User>> DeleteAsync(int userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return ServiceResult<User>.Failure(ServiceError.NotFound);
        }

        if (user.Role == UserRole.Admin)
        {
            return ServiceResult<User>.Failure(ServiceError.InvalidState);
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return ServiceResult<User>.Success(user);
    }

    private async Task<ServiceResult<User>> ChangeRoleAsync(int userId, UserRole from, UserRole to)
    {
        var result = await FindWithRoleAsync(userId, from);
        if (result.IsSuccess)
        {
            result.Value.Role = to;
            await db.SaveChangesAsync();
        }

        return result;
    }

    private async Task<ServiceResult<User>> FindWithRoleAsync(int userId, UserRole role)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return ServiceResult<User>.Failure(ServiceError.NotFound);
        }

        return user.Role == role
            ? ServiceResult<User>.Success(user)
            : ServiceResult<User>.Failure(ServiceError.InvalidState);
    }
}
