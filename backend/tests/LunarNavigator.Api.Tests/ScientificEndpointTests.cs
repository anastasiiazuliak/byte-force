using System.Net;
using System.Text;
using System.Text.Json;
using LunarNavigator.Api.Foundation;
using LunarNavigator.Api.Tests.TestSupport;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Ephemeris;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace LunarNavigator.Api.Tests;

public sealed class ScientificEndpointTests
{
    private const string RequestJson = """
        {"location":{"latitude":-89,"longitude":25},"period":{"startUtc":"2026-11-14T00:00:00Z","endUtc":"2026-11-14T02:00:00Z","stepMinutes":60}}
        """;

    [Fact]
    public async Task Analyze_DefaultUnavailableTerrain_ReturnsHonestPartialAndUtcZ()
    {
        using var factory = new ApiFactory();
        using var custom = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddSingleton<IEphemerisService>(new StubEphemeris())));
        using var http = custom.CreateClient();
        using var response = await http.PostAsync("/api/v1/analyze", Json(RequestJson));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;
        Assert.Equal(new[] { "status", "location", "period", "summary", "samples", "intervals", "horizon", "quality" }, root.EnumerateObject().Select(property => property.Name));
        Assert.Equal("partial", root.GetProperty("status").GetString());
        Assert.False(root.GetProperty("quality").GetProperty("terrainApplied").GetBoolean());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("summary").GetProperty("sunVisibleHours").ValueKind);
        Assert.Equal(JsonValueKind.Null, root.GetProperty("samples")[0].GetProperty("sun").GetProperty("visible").ValueKind);
        Assert.EndsWith("Z", root.GetProperty("samples")[0].GetProperty("timeUtc").GetString());
        Assert.Equal(3, root.GetProperty("samples").GetArrayLength());
    }

    [Theory]
    [InlineData("missing-dem.tif")]
    [InlineData("Data/landing-sites.json")]
    public async Task Composition_MissingOrInvalidDemRemainsAvailableAndUsesRealHorizon(string demPath)
    {
        using var factory = new ApiFactory();
        using var custom = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["Terrain:DemPath"] = demPath }));
            builder.ConfigureServices(services => services.AddSingleton<IEphemerisService>(new StubEphemeris()));
        });
        using var http = custom.CreateClient();
        Assert.IsType<LunarNavigator.Core.Horizon.LolaHorizonService>(
            custom.Services.GetRequiredService<IHorizonProfileProvider>());
        var profile = await custom.Services.GetRequiredService<IHorizonProfileProvider>()
            .GetProfileAsync(new TerrainLocation(-89, 25));
        Assert.False(profile.TerrainApplied);
        Assert.Empty(profile.Points);
        using var health = await http.GetAsync("/api/v1/health");
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);
        using var response = await http.PostAsync("/api/v1/analyze", Json(RequestJson));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("partial", json.RootElement.GetProperty("status").GetString());
        Assert.False(json.RootElement.GetProperty("quality").GetProperty("terrainApplied").GetBoolean());
    }

    [Fact]
    public async Task Analyze_TruncatedBigTiffReturnsPartialWithoutLeakingServerDetails()
    {
        var path = Path.Combine(Path.GetTempPath(), "private-truncated-dem-" + Guid.NewGuid() + ".tif");
        try
        {
            var bytes = File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Fixtures", "synthetic_lola_sample.tif"));
            File.WriteAllBytes(path, bytes[..^1]);
            using var factory = new ApiFactory();
            using var custom = factory.WithWebHostBuilder(builder =>
            {
                builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                    new Dictionary<string, string?> { ["Terrain:DemPath"] = path }));
                builder.ConfigureServices(services => services.AddSingleton<IEphemerisService>(new StubEphemeris()));
            });
            using var http = custom.CreateClient();
            Assert.False(custom.Services.GetRequiredService<LunarNavigator.Core.Terrain.ITerrainService>().IsAvailable);
            using var response = await http.PostAsync("/api/v1/analyze", Json(RequestJson));
            var body = await response.Content.ReadAsStringAsync();
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.DoesNotContain(path, body);
            Assert.DoesNotContain("InvalidDataException", body);
            using var json = JsonDocument.Parse(body);
            Assert.Equal("partial", json.RootElement.GetProperty("status").GetString());
            Assert.False(json.RootElement.GetProperty("quality").GetProperty("terrainApplied").GetBoolean());
            Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("samples")[0].GetProperty("sun").GetProperty("visible").ValueKind);
        }
        finally { File.Delete(path); }
    }

    [Theory]
    [InlineData("{broken", 400)]
    [InlineData("{}", 400)]
    [InlineData("{\"location\":{\"latitude\":-89},\"period\":{}}", 400)]
    [InlineData("{\"location\":{\"latitude\":-89,\"longitude\":25},\"period\":{\"startUtc\":\"2026-11-14T00:00:00Z\",\"endUtc\":\"2026-11-14T02:00:00Z\"}}", 400)]
    public async Task Analyze_MalformedAndMissingFieldsUseContractError(string body, int status)
    {
        using var factory = new ApiFactory();
        using var http = factory.CreateClient();
        using var response = await http.PostAsync("/api/v1/analyze", Json(body));
        Assert.Equal(status, (int)response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("VALIDATION_ERROR", json.RootElement.GetProperty("error").GetProperty("code").GetString());
        Assert.False(json.RootElement.GetProperty("error").TryGetProperty("details", out _));
    }

    [Theory]
    [InlineData("2026-11-14T00:00:00+00:00")]
    [InlineData("2026-11-14T02:00:00+02:00")]
    [InlineData("2026-11-14T00:00:00")]
    public async Task Analyze_RequiresExplicitUtcZ(string start)
    {
        using var factory = new ApiFactory();
        using var http = factory.CreateClient();
        using var response = await http.PostAsync("/api/v1/analyze", Json(RequestJson.Replace("2026-11-14T00:00:00Z", start)));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Analyze_BoundsAndEphemerisFailureUseTypedErrors()
    {
        using var factory = new ApiFactory();
        using var custom = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services => services.AddSingleton<IEphemerisService>(new StubEphemeris { Fail = true })));
        using var http = custom.CreateClient();
        using var bounds = await http.PostAsync("/api/v1/analyze", Json(RequestJson.Replace("-89", "-70")));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, bounds.StatusCode);
        using var response = await http.PostAsync("/api/v1/analyze", Json(RequestJson));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("EPHEMERIS_UNAVAILABLE", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Compare_ReturnsFullAnalysesAndUnknownDifferences()
    {
        using var factory = new ApiFactory();
        using var custom = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services => services.AddSingleton<IEphemerisService>(new StubEphemeris())));
        using var http = custom.CreateClient();
        var body = "{\"scenarios\":[" + RequestJson.Insert(1, "\"id\":\"B\",") + "," + RequestJson.Insert(1, "\"id\":\"A\",") + "]}";
        using var response = await http.PostAsync("/api/v1/compare", Json(body));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("A", json.RootElement.GetProperty("scenarios")[0].GetProperty("id").GetString());
        Assert.Equal(3, json.RootElement.GetProperty("scenarios")[1].GetProperty("analysis").GetProperty("samples").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("differences").GetProperty("sunVisibleHours").ValueKind);
    }

    [Fact]
    public async Task MapAndMoonFixedEndpointsRemainUnavailableWithoutVerifiedExternalData()
    {
        using var factory = new ApiFactory();
        using var http = factory.CreateClient();
        using var map = await http.GetAsync("/api/v1/map/metadata");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, map.StatusCode);
        Assert.Contains("TERRAIN_DATA_UNAVAILABLE", await map.Content.ReadAsStringAsync());
        using var ephemeris = await http.PostAsync("/api/v1/ephemeris", Json("""
            {"startUtc":"2026-11-14T00:00:00Z","endUtc":"2026-11-14T02:00:00Z","stepMinutes":60}
            """));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, ephemeris.StatusCode);
        Assert.Contains("EPHEMERIS_UNAVAILABLE", await ephemeris.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Analyze_RequestDeadlineReturns504InsteadOfAbortingResponse()
    {
        using var factory = new ApiFactory();
        using var custom = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Api:RequestTimeoutSeconds"] = "1" }));
            builder.ConfigureServices(services => services.AddSingleton<IEphemerisService>(new WaitingEphemeris()));
        });
        using var http = custom.CreateClient();
        using var response = await http.PostAsync("/api/v1/analyze", Json(RequestJson));
        Assert.Equal(HttpStatusCode.GatewayTimeout, response.StatusCode);
        Assert.Contains("ANALYSIS_TIMEOUT", await response.Content.ReadAsStringAsync());
    }

    private static StringContent Json(string value) => new(value, Encoding.UTF8, "application/json");

    private sealed class WaitingEphemeris : IEphemerisService
    {
        public async Task<IReadOnlyList<LunarNavigator.Models.LunarObservation>> GetAsync(
            Coordinates location, double altitudeKilometers, AnalysisPeriod period, CancellationToken cancellationToken = default)
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
            throw new InvalidOperationException("Cancellation ignored.");
        }
    }
}
