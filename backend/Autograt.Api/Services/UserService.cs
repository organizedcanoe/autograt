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
    /// Removes a pending user, e.g. a duplicate sign-up. Pending users cannot log in, so they have no journal data.
    /// Fails with InvalidState when the user is not pending.
    /// </summary>
    public async Task<ServiceResult<User>> DeletePendingAsync(int userId)
    {
        var result = await FindWithRoleAsync(userId, UserRole.Pending);
        if (result.IsSuccess)
        {
            db.Users.Remove(result.Value);
            await db.SaveChangesAsync();
        }

        return result;
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
