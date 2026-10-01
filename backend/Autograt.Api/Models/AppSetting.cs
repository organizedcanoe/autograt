namespace Autograt.Api.Models;

/// <summary>A server-wide setting that admins manage. A setting with no row uses its default.</summary>
public class AppSetting
{
    public AppSettingKey Key { get; set; }

    public required string Value { get; set; }
}

public enum AppSettingKey
{
    /// <summary>Whether anyone can register: "on" (the default) or "off".</summary>
    RegistrationOpen = 1,
}
