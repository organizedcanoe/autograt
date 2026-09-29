using System.Net;
using System.Net.Http.Json;
using Autograt.Api.Contracts;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests;

public class VersionEndpointTests : IClassFixture<AutogratApiFactory>
{
    private readonly HttpClient _client;

    public VersionEndpointTests(AutogratApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetVersion_WithoutBuildArgs_ReturnsDevFallback()
    {
        var response = await _client.GetAsync("/api/version");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<VersionResponse>();
        Assert.Equal("0.0.0-dev", body?.Version);
        Assert.Equal("local", body?.Commit);
        Assert.Null(body?.BuildDate);
    }

    [Fact]
    public void FromBuild_SplitsVersionAndCommit()
    {
        var info = VersionResponse.FromBuild("0.1.42+a1b2c3d", "2026-09-28T12:00:00Z");

        Assert.Equal(new VersionResponse("0.1.42", "a1b2c3d", "2026-09-28T12:00:00Z"), info);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void FromBuild_WithoutInformationalVersion_ReturnsDevFallback(string? informationalVersion)
    {
        var info = VersionResponse.FromBuild(informationalVersion, "");

        Assert.Equal(new VersionResponse("0.0.0-dev", "local", null), info);
    }
}
