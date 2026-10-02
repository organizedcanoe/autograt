using System.Globalization;

namespace Autograt.Api.Models;

/// <summary>
/// The values a setting accepts and the defaults used until the user saves their own (none when the server can't
/// choose one for them). A value must be one of
/// <see cref="AllowedValues"/> when they are given, and must pass <see cref="IsValid"/> when it is given.
/// </summary>
public sealed record SettingDefinition(IReadOnlyList<string> Defaults)
{
    public IReadOnlyList<string>? AllowedValues { get; init; }

    /// <summary>A check for free-form values; <see cref="InvalidValueHint"/> explains what it expects.</summary>
    public Func<string, bool>? IsValid { get; init; }

    public string? InvalidValueHint { get; init; }

    /// <summary>How many values the setting takes at most; 1 for a single-value setting.</summary>
    public int MaxValues { get; init; } = 1;

    /// <returns>Why the values are invalid, or null when they are valid.</returns>
    public string? Validate(IReadOnlyList<string> values)
    {
        if (values.Count == 0)
        {
            return "Choose a value.";
        }

        if (values.Count > MaxValues)
        {
            return MaxValues == 1 ? "Choose only one value." : $"Choose at most {MaxValues} values.";
        }

        if (values.Distinct().Count() != values.Count)
        {
            return "Each value can only be chosen once.";
        }

        if (AllowedValues is not null)
        {
            var notAllowed = values.FirstOrDefault(v => AllowedValues.Contains(v) == false);
            if (notAllowed is not null)
            {
                return $"'{notAllowed}' is not a valid value. Choose one of: {string.Join(", ", AllowedValues)}.";
            }
        }

        if (IsValid is not null)
        {
            var invalid = values.FirstOrDefault(v => IsValid(v) == false);
            if (invalid is not null)
            {
                return $"'{invalid}' is not a valid value. {InvalidValueHint}";
            }
        }

        return null;
    }
}

public static class SettingDefinitions
{
    public const string On = "on";
    private const string TimeFormat = "HH:mm";

    private static readonly Dictionary<Setting, SettingDefinition> Definitions = new()
    {
        [Setting.BrightnessTheme] = new(Defaults: ["system"]) { AllowedValues = ["system", "light", "dark"] },
        // Must match the theme colours the frontend offers.
        [Setting.ColourTheme] = new(Defaults: ["azure"]) { AllowedValues = ["azure", "jade", "violet", "pumpkin", "pink", "slate"] },
        [Setting.RemindersEnabled] = new(Defaults: ["off"]) { AllowedValues = [On, "off"] },
        [Setting.ReminderTime] = new(Defaults: ["12:00", "20:00"])
        {
            IsValid = value => TryParseTime(value, out _),
            InvalidValueHint = "Use a 24-hour time such as 08:30.",
            MaxValues = 4, // Keeps the reminder scheduler cheap and the settings page tidy.
        },
        [Setting.TimeZone] = new(Defaults: [])
        {
            IsValid = value => TimeZoneInfo.TryFindSystemTimeZoneById(value, out _),
            InvalidValueHint = "Use an IANA time zone such as America/Toronto.",
        },
    };

    public static SettingDefinition For(Setting setting) => Definitions[setting];

    /// <summary>Parses a reminder time in the exact "HH:mm" format, e.g. "08:30".</summary>
    public static bool TryParseTime(string value, out TimeOnly time) =>
        TimeOnly.TryParseExact(value, TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
}
