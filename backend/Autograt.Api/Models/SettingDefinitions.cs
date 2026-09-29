namespace Autograt.Api.Models;

/// <summary>The values a setting accepts and the defaults used until the user saves their own.</summary>
public sealed record SettingDefinition(IReadOnlyList<string> AllowedValues, IReadOnlyList<string> Defaults, bool AllowsMultiple = false)
{
    /// <returns>Why the values are invalid, or null when they are valid.</returns>
    public string? Validate(IReadOnlyList<string> values)
    {
        if (values.Count == 0)
        {
            return "Choose a value.";
        }

        if (AllowsMultiple == false && values.Count > 1)
        {
            return "Choose only one value.";
        }

        if (values.Distinct().Count() != values.Count)
        {
            return "Each value can only be chosen once.";
        }

        var invalid = values.FirstOrDefault(v => AllowedValues.Contains(v) == false);
        return invalid is null ? null : $"'{invalid}' is not a valid value. Choose one of: {string.Join(", ", AllowedValues)}.";
    }
}

public static class SettingDefinitions
{
    private static readonly Dictionary<Setting, SettingDefinition> Definitions = new()
    {
        [Setting.BrightnessTheme] = new(AllowedValues: ["system", "light", "dark"], Defaults: ["system"]),
        // Must match the theme colours the frontend offers.
        [Setting.ColourTheme] = new(AllowedValues: ["azure", "jade", "violet", "pumpkin", "pink", "slate"], Defaults: ["azure"]),
    };

    public static SettingDefinition For(Setting setting) => Definitions[setting];
}
