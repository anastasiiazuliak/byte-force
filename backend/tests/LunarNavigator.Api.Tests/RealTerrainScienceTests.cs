using System.Net;
using System.Text;
using System.Text.Json;
using LunarNavigator.Api.Tests.TestSupport;
using LunarNavigator.Core.Analysis;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace LunarNavigator.Api.Tests;

public sealed class RealTerrainScienceFactAttribute : FactAttribute
{
    public RealTerrainScienceFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SCIENCE_REAL_DEM")) ||
            Environment.GetEnvironmentVariable("SCIENCE_LIVE_API") != "1")
            Skip = "Opt-in real DEM and live NASA API checks; set SCIENCE_REAL_DEM and SCIENCE_LIVE_API=1.";
    }
}

public sealed class RealTerrainScienceTests
{
    [RealTerrainScienceFact]
    public async Task RealAnalyzeAndCompare_ReturnRegionalTerrainWithoutGlobalVisibility()
    {
        using var factory = new ApiFactory();
        using var custom = factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string,string?>
            {
                ["Terrain:DemPath"] = Environment.GetEnvironmentVariable("SCIENCE_REAL_DEM"),
                ["MapManifest:MetadataReviewConfirmed"] = "false"
            })));
        using var client = custom.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(100);
        var height = await custom.Services.GetRequiredService<ITerrainHeightProvider>().GetHeightAsync(new(-89,25));
        Assert.NotNull(height.ElevationM);
        Assert.True(height.DatumAlignmentVerified);
        const string request = """
            {"location":{"latitude":-89,"longitude":25},"period":{"startUtc":"2026-11-14T00:00:00Z","endUtc":"2026-11-14T00:10:00Z","stepMinutes":10}}
            """;
        using var analyze = await client.PostAsync("/api/v1/analyze", Json(request));
        Assert.Equal(HttpStatusCode.OK, analyze.StatusCode);
        string body = await analyze.Content.ReadAsStringAsync();
        Save("science-live-analyze.json", body);
        using var result = JsonDocument.Parse(body);
        AssertPartial(result.RootElement);
        foreach (var sample in result.RootElement.GetProperty("samples").EnumerateArray())
            Assert.Equal(JsonValueKind.Number, sample.GetProperty("sun").GetProperty("elevationDeg").ValueKind);
        var comparison = "{\"scenarios\":[" + request.Insert(1,"\"id\":\"A\",") + "," + request.Insert(1,"\"id\":\"B\",") + "]}";
        using var compare = await client.PostAsync("/api/v1/compare", Json(comparison));
        Assert.Equal(HttpStatusCode.OK, compare.StatusCode);
        body = await compare.Content.ReadAsStringAsync();
        Save("science-live-compare.json", body);
        using var compared = JsonDocument.Parse(body);
        foreach (var scenario in compared.RootElement.GetProperty("scenarios").EnumerateArray())
            AssertPartial(scenario.GetProperty("analysis"));
    }

    private static void AssertPartial(JsonElement result)
    {
        Assert.Equal("partial", result.GetProperty("status").GetString());
        Assert.False(result.GetProperty("quality").GetProperty("terrainApplied").GetBoolean());
        Assert.Equal(JsonValueKind.Null, result.GetProperty("summary").GetProperty("sunVisibleHours").ValueKind);
        Assert.Equal(360, result.GetProperty("horizon").GetProperty("points").GetArrayLength());
        Assert.Contains(result.GetProperty("quality").GetProperty("warnings").EnumerateArray(), w => w.GetString()!.Contains("global skyline completeness"));
        foreach (var sample in result.GetProperty("samples").EnumerateArray())
        {
            foreach (var bodyName in new[] { "sun", "earth" })
            {
                var body = sample.GetProperty(bodyName);
                Assert.Equal(JsonValueKind.Null, body.GetProperty("visible").ValueKind);
                Assert.Equal(JsonValueKind.Number, body.GetProperty("horizonDeg").ValueKind);
                Assert.Equal(body.GetProperty("elevationDeg").GetDouble() - body.GetProperty("horizonDeg").GetDouble(), body.GetProperty("clearanceDeg").GetDouble(), 10);
            }
        }
    }
    private static StringContent Json(string value) => new(value, Encoding.UTF8, "application/json");
    private static void Save(string name, string body)
    {
        var directory = Environment.GetEnvironmentVariable("SCIENCE_LOG_DIRECTORY");
        if (!string.IsNullOrEmpty(directory)) File.WriteAllText(Path.Combine(directory,name), body);
    }
}
