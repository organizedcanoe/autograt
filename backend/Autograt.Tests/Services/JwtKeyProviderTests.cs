using System.Text;
using Autograt.Api.Services;

namespace Autograt.Tests.Services;

public class JwtKeyProviderTests : IDisposable
{
    private readonly string _dataDirectory =
        Path.Combine(Path.GetTempPath(), $"autograt-keys-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_dataDirectory)) Directory.Delete(_dataDirectory, recursive: true);
    }

    [Fact]
    public void ConfiguredKey_IsUsedWithoutCreatingAFile()
    {
        const string configured = "configured-key-that-is-at-least-32-bytes";

        var key = JwtKeyProvider.GetOrCreateKey(configured, _dataDirectory);

        Assert.Equal(Encoding.UTF8.GetBytes(configured), key);
        Assert.False(File.Exists(Path.Combine(_dataDirectory, JwtKeyProvider.KeyFileName)));
    }

    [Fact]
    public void ConfiguredKey_ShorterThan32Bytes_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => JwtKeyProvider.GetOrCreateKey("too-short", _dataDirectory));
    }

    [Fact]
    public void MissingKey_IsGeneratedOnce_AndReusedAfterwards()
    {
        var first = JwtKeyProvider.GetOrCreateKey(null, _dataDirectory);
        var second = JwtKeyProvider.GetOrCreateKey(null, _dataDirectory);

        Assert.True(first.Length >= 32);
        Assert.Equal(first, second);
        Assert.True(File.Exists(Path.Combine(_dataDirectory, JwtKeyProvider.KeyFileName)));
    }
}
