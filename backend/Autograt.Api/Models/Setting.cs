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

    /// <summary>
    /// The user's IANA time zone, e.g. "America/Toronto". It decides when "today" starts and ends and what time
    /// reminders are sent at. It has no default, since the server can't know it until the user saves one.
    /// </summary>
    TimeZone = 5,
}
