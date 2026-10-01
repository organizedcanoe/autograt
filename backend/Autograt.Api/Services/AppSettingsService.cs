using Autograt.Api.Data;
using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Autograt.Api.Services;

/// <summary>Server-wide settings that admins manage, such as whether registration is open.</summary>
public class AppSettingsService(AutogratDbContext db)
{
    private const string On = "on";
    private const string Off = "off";

    public async Task<bool> IsRegistrationOpenAsync() =>
        await GetAsync(AppSettingKey.RegistrationOpen) != Off;

    public Task SetRegistrationOpenAsync(bool open) =>
        SetAsync(AppSettingKey.RegistrationOpen, open ? On : Off);

    private Task<string?> GetAsync(AppSettingKey key) =>
        db.AppSettings.AsNoTracking().Where(s => s.Key == key).Select(s => s.Value).SingleOrDefaultAsync();

    private async Task SetAsync(AppSettingKey key, string value)
    {
        var setting = await db.AppSettings.FindAsync(key);
        if (setting is null)
        {
            db.AppSettings.Add(new AppSetting { Key = key, Value = value });
        }
        else
        {
            setting.Value = value;
        }

        await db.SaveChangesAsync();
    }
}
