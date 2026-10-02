using Autograt.Api.Contracts;
using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

public class SettingsService(AutogratDbContext db)
{
    /// <summary>Every setting for the user, falling back to the default for settings they have not saved.</summary>
    public async Task<List<SettingResponse>> GetAllAsync(int userId)
    {
        var saved = await db.UserSettings.AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Id)
            .ToListAsync();

        return Enum.GetValues<Setting>()
            .Select(setting =>
            {
                var values = saved.Where(s => s.Setting == setting).Select(s => s.Value).ToList();
                return new SettingResponse(setting, values.Count > 0 ? values : SettingDefinitions.For(setting).Defaults);
            })
            .ToList();
    }

    /// <returns>The user's saved time zone, or null if they have not saved one the server knows.</returns>
    public async Task<TimeZoneInfo?> GetTimeZoneAsync(int userId)
    {
        var timeZoneId = await db.UserSettings
            .Where(s => s.UserId == userId && s.Setting == Setting.TimeZone)
            .Select(s => s.Value)
            .FirstOrDefaultAsync();

        return FindTimeZone(timeZoneId);
    }

    /// <returns>The time zone with the IANA id, or null if the id is null or unknown.</returns>
    public static TimeZoneInfo? FindTimeZone(string? timeZoneId) =>
        timeZoneId is not null && TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId, out var timeZone) ? timeZone : null;

    /// <summary>Replaces the user's values for one setting. The values must already be validated.</summary>
    public async Task<SettingResponse> UpdateAsync(int userId, Setting setting, IReadOnlyList<string> values)
    {
        var existing = await db.UserSettings.Where(s => s.UserId == userId && s.Setting == setting).ToListAsync();
        db.UserSettings.RemoveRange(existing);
        db.UserSettings.AddRange(values.Select(value => new UserSetting { UserId = userId, Setting = setting, Value = value }));
        await db.SaveChangesAsync();

        return new SettingResponse(setting, values);
    }
}
