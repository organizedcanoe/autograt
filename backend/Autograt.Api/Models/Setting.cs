namespace Autograt.Api.Models;

/// <summary>A user preference. Values are stored as strings; see <see cref="SettingDefinitions"/> for what each accepts.</summary>
public enum Setting
{
    /// <summary>Light or dark mode: "system", "light" or "dark".</summary>
    BrightnessTheme = 1,

    /// <summary>The accent colour, e.g. "azure" or "jade".</summary>
    ColourTheme = 2,
}
