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

    /// <returns>False when the user does not exist.</returns>
    public async Task<bool> PromoteToAdminAsync(int userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return false;
        }

        user.IsAdmin = true;
        await db.SaveChangesAsync();
        return true;
    }
}
