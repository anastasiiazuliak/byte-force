using System.Net;
using System.Text.Json;
using LunarNavigator.Core.Analysis;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace LunarNavigator.Tests.Api;

public sealed class HealthSmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;

    public HealthSmokeTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    [Fact]
    public async Task HealthReturnsContractJson()
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("ok", json.RootElement.GetProperty("status").GetString());
        Assert.False(string.IsNullOrWhiteSpace(json.RootElement.GetProperty("version").GetString()));
    }

    [Fact]
    public async Task DefaultProvidersExplicitlyReportUnavailable()
    {
        using var scope = factory.Services.CreateScope();
        var location = new TerrainLocation(-89, 0);
        var height = await scope.ServiceProvider.GetRequiredService<ITerrainHeightProvider>().GetHeightAsync(location);
        var horizon = await scope.ServiceProvider.GetRequiredService<IHorizonProfileProvider>().GetProfileAsync(location);
        Assert.Null(height.ElevationM);
        Assert.Null(height.VerticalReference);
        Assert.False(height.DatumAlignmentVerified);
        Assert.NotEmpty(height.Warnings);
        Assert.False(horizon.TerrainApplied);
        Assert.Empty(horizon.Points);
        Assert.NotEmpty(horizon.Warnings);
    }
}
