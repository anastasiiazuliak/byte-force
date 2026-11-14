using System.Net;
using System.Text.Json;
using LunarNavigator.Api.Contracts;
using LunarNavigator.Api.Foundation;
using LunarNavigator.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace LunarNavigator.Api.Tests;

public sealed class FoundationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public FoundationTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOnlyServerStatusAndVersion()
    {
        using var response = await _client.GetAsync("/api/v1/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(new[] { "status", "version" }, json.RootElement.EnumerateObject().Select(p => p.Name));
        Assert.Equal("ok", json.RootElement.GetProperty("status").GetString());
        Assert.True(Version.TryParse(json.RootElement.GetProperty("version").GetString(), out _));
    }

    [Fact]
    public async Task Config_ReturnsSettingsAndUnavailableFeatures()
    {
        using var response = await _client.GetAsync("/api/v1/config");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;
        Assert.Equal(new[] { "region", "analysis", "features" }, root.EnumerateObject().Select(p => p.Name));
        var region = root.GetProperty("region");
        Assert.Equal(-90, region.GetProperty("latitudeMin").GetDouble());
        Assert.Equal(-80, region.GetProperty("latitudeMax").GetDouble());
        Assert.Equal(-180, region.GetProperty("longitudeMin").GetDouble());
        Assert.Equal(180, region.GetProperty("longitudeMax").GetDouble());
        Assert.Equal(1234, root.GetProperty("analysis").GetProperty("maxSamples").GetInt32());
        Assert.True(root.GetProperty("features").GetProperty("scenarioComparison").GetBoolean());
        foreach (var name in new[] { "terrainAnalysis", "horizonProfile", "moonFixedEphemeris" })
            Assert.False(root.GetProperty("features").GetProperty(name).GetBoolean());
    }

    [Fact]
    public async Task LandingSites_ReturnsExpectedShapeAndDemoLabels()
    {
        using var response = await _client.GetAsync("/api/v1/landing-sites");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var sites = json.RootElement.GetProperty("sites").EnumerateArray().ToArray();
        Assert.Equal(2, sites.Length);
        foreach (var site in sites)
        {
            Assert.Equal(new[] { "id", "name", "description", "latitude", "longitude", "sourceUrl" },
                site.EnumerateObject().Select(p => p.Name));
            Assert.StartsWith("DEMO ", site.GetProperty("name").GetString());
            Assert.Equal(JsonValueKind.Null, site.GetProperty("sourceUrl").ValueKind);
        }
    }

    [Theory]
    [InlineData("/api/v1/missing", "GET", 404, "VALIDATION_ERROR")]
    [InlineData("/api/v1/config", "POST", 405, "VALIDATION_ERROR")]
    public async Task RoutingErrors_ReturnSharedEnvelope(string path, string method, int status, string code)
    {
        using var response = await _client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));
        Assert.Equal(status, (int)response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(code, json.RootElement.GetProperty("error").GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("http://localhost:5173", true)]
    [InlineData("https://untrusted.example", false)]
    public async Task Cors_AllowsOnlyConfiguredOrigins(string origin, bool allowed)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/config");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        using var response = await _client.SendAsync(request);
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        if (allowed)
            Assert.Equal(origin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task LandingSites_ReturnsSanitized503_WhenCatalogIsMissing()
    {
        using var custom = _factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Api:CatalogPath"] = "private-missing-file.json" })));
        using var http = custom.CreateClient();
        using var response = await http.GetAsync("/api/v1/landing-sites");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("private-missing-file", body);
        using var json = JsonDocument.Parse(body);
        Assert.Equal("INTERNAL_ERROR", json.RootElement.GetProperty("error").GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync("/api/v1/health")).StatusCode);
    }

    [Fact]
    public async Task LandingSites_HidesExceptionMessage_WhenCatalogFails()
    {
        using var custom = _factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddSingleton<ILandingSiteCatalog>(new BrokenCatalog())));
        using var http = custom.CreateClient();
        using var response = await http.GetAsync("/api/v1/landing-sites");
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("INTERNAL_ERROR", body);
        Assert.DoesNotContain("secret", body);
    }

    [Fact]
    public void Validation_ReturnsSharedErrorEnvelope()
    {
        var options = _factory.Services.GetRequiredService<IOptions<ApiBehaviorOptions>>().Value;
        var result = Assert.IsType<BadRequestObjectResult>(options.InvalidModelStateResponseFactory(new ActionContext()));
        Assert.Equal("VALIDATION_ERROR", Assert.IsType<ErrorResponse>(result.Value).Error.Code);
    }

    private sealed class BrokenCatalog : ILandingSiteCatalog
    {
        public Task<IReadOnlyList<LandingSite>> GetAsync(CancellationToken cancellationToken) =>
            throw new InvalidOperationException("secret");
    }
}
