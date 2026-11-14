using System.Net;
using System.Text;
using LunarNavigator.Api.Tests.TestSupport;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Ephemeris;
using LunarNavigator.Core.Map;
using LunarNavigator.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace LunarNavigator.Api.Tests.Contracts;

public sealed class ContractPayloadTests
{
    private const string RequestJson = """{"location":{"latitude":-89,"longitude":25},"period":{"startUtc":"2026-11-14T00:00:00Z","endUtc":"2026-11-14T02:00:00Z","stepMinutes":60}}""";
    private static readonly string Output = Path.Combine(AppContext.BaseDirectory, "ContractResponses");

    [Xunit.Fact]
    public async Task ExportPayloads_ForFrozenOpenApi()
    {
        Directory.CreateDirectory(Output);
        using var factory = new ApiFactory();
        using var partial = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.AddSingleton<IEphemerisService>(new SyntheticEphemeris());
            services.AddSingleton<ITerrainHeightProvider>(new SyntheticMissingTerrain());
        }));
        using var http = partial.CreateClient();
        await Emit("HealthResponse", await http.GetAsync("/api/v1/health"));
        await Emit("ConfigResponse", await http.GetAsync("/api/v1/config"));
        await Emit("LandingSitesResponse", await http.GetAsync("/api/v1/landing-sites"));
        await Emit("AnalysisResponse.partial", await http.PostAsync("/api/v1/analyze", Json(RequestJson)));
        await Emit("ApiError.validation", await http.PostAsync("/api/v1/analyze", Json("{}")), HttpStatusCode.BadRequest);
        await Emit("ApiError.bounds", await http.PostAsync("/api/v1/analyze", Json(RequestJson.Replace("-89", "-70"))), HttpStatusCode.UnprocessableEntity);
        await Emit("ApiError.map", await http.GetAsync("/api/v1/map/metadata"), HttpStatusCode.ServiceUnavailable);
        await Emit("ApiError.ephemeris", await http.PostAsync("/api/v1/ephemeris", Json("""{"startUtc":"2026-11-14T00:00:00Z","endUtc":"2026-11-14T02:00:00Z","stepMinutes":60}""")), HttpStatusCode.ServiceUnavailable);
        using var complete = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.AddSingleton<IEphemerisService>(new SyntheticEphemeris());
            services.AddSingleton<ITerrainHeightProvider>(new SyntheticTerrain());
            services.AddSingleton<IHorizonProfileProvider>(new SyntheticTerrain());
            services.AddSingleton<IMoonFixedProvider>(new SyntheticVectors());
            services.AddSingleton<IMapMetadataService>(new SyntheticMap());
        }));
        using var full = complete.CreateClient();
        await Emit("AnalysisResponse.complete", await full.PostAsync("/api/v1/analyze", Json(RequestJson)));
        var compare = "{\"scenarios\":[" + RequestJson.Insert(1, "\"id\":\"A\",") + "," + RequestJson.Insert(1, "\"id\":\"B\",") + "]}";
        await Emit("CompareResponse", await full.PostAsync("/api/v1/compare", Json(compare)));
        await Emit("MapMetadataResponse", await full.GetAsync("/api/v1/map/metadata"));
        await Emit("EphemerisResponse", await full.PostAsync("/api/v1/ephemeris", Json("""{"startUtc":"2026-11-14T00:00:00Z","endUtc":"2026-11-14T02:00:00Z","stepMinutes":60}""")));
        Console.WriteLine("Exported 12 HTTP responses from the actual middleware/controller pipeline. Scientific fixtures are SYNTHETIC TEST ONLY.");
    }

    private static StringContent Json(string value) => new(value, Encoding.UTF8, "application/json");
    private static async Task Emit(string name, HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        using (response)
        {
            var text = await response.Content.ReadAsStringAsync();
            if (response.StatusCode != expected) throw new InvalidOperationException(name + ": " + response.StatusCode + " " + text);
            await File.WriteAllTextAsync(Path.Combine(Output, name + ".json"), text);
        }
    }

    private sealed class SyntheticEphemeris : IEphemerisService
    {
        public Task<IReadOnlyList<LunarObservation>> GetAsync(Coordinates location, double altitudeKilometers, AnalysisPeriod period, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<LunarObservation>>(RequestValidation.SampleTimes(period).Select(time => new LunarObservation(time, 1, 0, -1, 180)).ToArray());
    }

    private sealed class SyntheticTerrain : ITerrainHeightProvider, IHorizonProfileProvider
    {
        public Task<TerrainHeightResult> GetHeightAsync(TerrainLocation location, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TerrainHeightResult(120, "SYNTHETIC TEST ONLY", ObserverAltitudeResolver.HorizonsDatum, 80, true,
                ["SYNTHETIC TEST ONLY: ephemerides and terrain are fabricated for schema validation."]));
        public Task<HorizonProfileResult> GetProfileAsync(TerrainLocation location, CancellationToken cancellationToken = default) =>
            Task.FromResult(new HorizonProfileResult(Enumerable.Range(0, 360).Select(index => new HorizonPoint(index, 0)).ToArray(), true, "SYNTHETIC TEST ONLY", 80, []));
    }

    private sealed class SyntheticMissingTerrain : ITerrainHeightProvider
    {
        public Task<TerrainHeightResult> GetHeightAsync(TerrainLocation location, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TerrainHeightResult(null, "SYNTHETIC TEST ONLY", null, null, false,
                ["SYNTHETIC TEST ONLY: ephemerides are fabricated and terrain is unavailable for schema validation."]));
    }

    private sealed class SyntheticVectors : IMoonFixedProvider
    {
        public bool IsVerified => true;
        public Task<MoonFixedProviderResult> GetAsync(AnalysisPeriod period, CancellationToken cancellationToken = default) =>
            Task.FromResult(new MoonFixedProviderResult(true, "MOON_ME", "unit XYZ synthetic test vectors",
                RequestValidation.SampleTimes(period).Select(time => new EphemerisSample(time, new[] { 3.0, 4, 0 }, new[] { 0.0, 0, 5 })).ToArray(),
                new EphemerisQuality("SYNTHETIC TEST ONLY", [])));
    }

    private sealed class SyntheticMap : IMapMetadataService
    {
        public Task<MapMetadata> GetAsync(CancellationToken cancellationToken = default) => Task.FromResult(new MapMetadata("lunar-south-pole",
            new MapProjection("south-polar-stereographic", null, null, "m"), new MapRender("projected-terrain", 256, 0, 0, null, null),
            new MapAssets(null, null, null, null), new TerrainDataset("SYNTHETIC TEST ONLY", 80, null, false)));
    }
}
