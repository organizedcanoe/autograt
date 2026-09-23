using System.Net;
using System.Net.Http.Json;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests;

public class HealthEndpointTests : IClassFixture<AutogratApiFactory>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(AutogratApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHealth_ReturnsOkWithStatus()
    {
        var response = await _client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.Equal("ok", body?.Status);
    }

    private sealed record HealthResponse(string Status);
}
