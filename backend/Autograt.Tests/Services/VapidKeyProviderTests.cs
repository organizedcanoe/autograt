using Autograt.Api.Services;

namespace Autograt.Tests.Services;

public class VapidKeyProviderTests : IDisposable
{
    private readonly string _dataDirectory =
        Path.Combine(Path.GetTempPath(), $"autograt-vapid-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_dataDirectory)) Directory.Delete(_dataDirectory, recursive: true);
    }

    [Fact]
    public void ConfiguredKeys_AreUsedWithoutCreatingAFile()
    {
        var keys = VapidKeyProvider.GetOrCreateKeys("public-key", "private-key", _dataDirectory);

        Assert.Equal(new VapidKeys("public-key", "private-key"), keys);
        Assert.False(File.Exists(Path.Combine(_dataDirectory, VapidKeyProvider.KeyFileName)));
    }

    [Theory]
    [InlineData("public-key", null)]
    [InlineData(null, "private-key")]
    public void OnlyOneConfiguredKey_Throws(string? publicKey, string? privateKey)
    {
        Assert.Throws<InvalidOperationException>(() => VapidKeyProvider.GetOrCreateKeys(publicKey, privateKey, _dataDirectory));
    }

    [Fact]
    public void MissingKeys_AreGeneratedOnce_AndReusedAfterwards()
    {
        var first = VapidKeyProvider.GetOrCreateKeys(null, null, _dataDirectory);
        var second = VapidKeyProvider.GetOrCreateKeys(null, null, _dataDirectory);

        Assert.False(string.IsNullOrEmpty(first.PublicKey));
        Assert.False(string.IsNullOrEmpty(first.PrivateKey));
        Assert.Equal(first, second);
        Assert.True(File.Exists(Path.Combine(_dataDirectory, VapidKeyProvider.KeyFileName)));
    }
}
