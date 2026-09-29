namespace Autograt.Api.Models;

/// <summary>A user preference. Values are stored as strings; see <see cref="SettingDefinitions"/> for what each accepts.</summary>
public enum Setting
{
    /// <summary>Light or dark mode: "system", "light" or "dark".</summary>
    BrightnessTheme = 1,

    /// <summary>The accent colour, e.g. "azure" or "jade".</summary>
    ColourTheme = 2,

    /// <summary>Whether reminder notifications are sent: "on" or "off".</summary>
    RemindersEnabled = 3,

    /// <summary>The local times reminders are sent at, as 24-hour "HH:mm"; up to four values.</summary>
    ReminderTime = 4,

    /// <summary>The IANA time zone reminder times are in, e.g. "America/Toronto".</summary>
    TimeZone = 5,
}
