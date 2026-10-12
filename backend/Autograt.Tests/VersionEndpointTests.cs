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
    public async Task GetVersion_WithoutBuildDate_ReturnsBuildWithNullDate()
    {
        var response = await _client.GetAsync("/api/version");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<VersionResponse>();
        // A local build's version and commit come from git, so they change with every commit.
        Assert.False(string.IsNullOrWhiteSpace(body?.Version));
        Assert.False(string.IsNullOrWhiteSpace(body?.Commit));
        Assert.Null(body?.BuildDate);
    }

    [Fact]
    public void FromBuild_SplitsVersionAndCommit()
    {
        var info = VersionResponse.FromBuild("0.1.42+a1b2c3d", "2026-09-28T12:00:00Z");

        Assert.Equal(new VersionResponse("0.1.42", "a1b2c3d", "2026-09-28T12:00:00Z"), info);
    }

    [Fact]
    public void FromBuild_WithGitDescribeVersion_KeepsItWhole()
    {
        var info = VersionResponse.FromBuild("1.2.3-4-gabc1234-dirty+abc1234", null);

        Assert.Equal(new VersionResponse("1.2.3-4-gabc1234-dirty", "abc1234", null), info);
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
