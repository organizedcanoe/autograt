namespace Autograt.Api.Services;

/// <summary>Web Push settings. Leave the keys unset to have a pair generated into the data directory.</summary>
public sealed class PushOptions
{
    public const string SectionName = "Push";

    public string? VapidPublicKey { get; set; }

    public string? VapidPrivateKey { get; set; }

    /// <summary>A contact for push services: a "mailto:" address or the site's URL.</summary>
    public string Subject { get; set; } = "mailto:admin@localhost";
}
