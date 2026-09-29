using System.Text.Json;
using WebPush;

namespace Autograt.Api.Services;

/// <summary>The key pair the server signs push messages with, both base64url-encoded.</summary>
public sealed record VapidKeys(string PublicKey, string PrivateKey);

public static class VapidKeyProvider
{
    public const string KeyFileName = "vapid.json";

    /// <summary>
    /// Returns the configured key pair, or one generated once and saved in <paramref name="dataDirectory"/>
    /// so that browsers' push subscriptions stay valid across restarts.
    /// </summary>
    public static VapidKeys GetOrCreateKeys(string? configuredPublicKey, string? configuredPrivateKey, string dataDirectory)
    {
        if (!string.IsNullOrEmpty(configuredPublicKey) || !string.IsNullOrEmpty(configuredPrivateKey))
        {
            if (string.IsNullOrEmpty(configuredPublicKey) || string.IsNullOrEmpty(configuredPrivateKey))
            {
                throw new InvalidOperationException(
                    $"Configure both {PushOptions.SectionName}:{nameof(PushOptions.VapidPublicKey)} and "
                    + $"{PushOptions.SectionName}:{nameof(PushOptions.VapidPrivateKey)}, or neither.");
            }

            return new VapidKeys(configuredPublicKey, configuredPrivateKey);
        }

        var keyPath = Path.Combine(dataDirectory, KeyFileName);
        if (File.Exists(keyPath))
        {
            return JsonSerializer.Deserialize<VapidKeys>(File.ReadAllText(keyPath))
                ?? throw new InvalidOperationException($"{keyPath} is empty.");
        }

        var generated = VapidHelper.GenerateVapidKeys();
        var keys = new VapidKeys(generated.PublicKey, generated.PrivateKey);
        Directory.CreateDirectory(dataDirectory);
        File.WriteAllText(keyPath, JsonSerializer.Serialize(keys));
        return keys;
    }
}
