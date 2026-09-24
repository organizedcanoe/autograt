using System.Security.Cryptography;
using System.Text;

namespace Autograt.Api.Services;

public static class JwtKeyProvider
{
    public const string KeyFileName = "jwt.key";

    private const int MinimumKeyBytes = 32; // HMAC-SHA256 requires a key of at least 256 bits.

    /// <summary>
    /// Returns the configured signing key, or one generated once and saved in <paramref name="dataDirectory"/>
    /// so that issued tokens stay valid across restarts.
    /// </summary>
    public static byte[] GetOrCreateKey(string? configuredKey, string dataDirectory)
    {
        if (!string.IsNullOrEmpty(configuredKey))
        {
            var key = Encoding.UTF8.GetBytes(configuredKey);
            if (key.Length < MinimumKeyBytes)
            {
                throw new InvalidOperationException($"Jwt:Key must be at least {MinimumKeyBytes} bytes long.");
            }

            return key;
        }

        var keyPath = Path.Combine(dataDirectory, KeyFileName);
        if (File.Exists(keyPath))
        {
            return Convert.FromBase64String(File.ReadAllText(keyPath));
        }

        var generated = RandomNumberGenerator.GetBytes(64);
        Directory.CreateDirectory(dataDirectory);
        File.WriteAllText(keyPath, Convert.ToBase64String(generated));
        return generated;
    }
}
