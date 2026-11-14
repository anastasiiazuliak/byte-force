using System.Text.Json;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Horizon;
using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Core.Tests.Horizon;

public class LolaHorizonServiceTests
{
    private sealed class SyntheticTerrainService : ITerrainService
    {
        private readonly Func<double, double, float> _heightAtProjectedMeters;
        public int WindowCallCount { get; private set; }
        public bool IsAvailable { get; init; } = true;
        public double ResolutionMeters { get; init; } = 80.0;

        public SyntheticTerrainService(Func<double, double, float> heightAtProjectedMeters)
        {
            _heightAtProjectedMeters = heightAtProjectedMeters;
        }

        public Task<TerrainHeightResult> GetElevationAsync(TerrainLocation location, CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var (x, y) = LunarProjection.ToProjected(location.Latitude, location.Longitude);
            float h = _heightAtProjectedMeters(x, y);
            double? elev = float.IsNaN(h) ? null : h;
            return Task.FromResult(new TerrainHeightResult(
                elev,
                "Synthetic-Test-DEM",
                "Moon (2015) Sphere R=1737400m",
                ResolutionMeters,
                true,
                Array.Empty<string>()));
        }

        public Task<TerrainHeightResult> GetHeightAsync(TerrainLocation location, CancellationToken cancellationToken = default) =>
            GetElevationAsync(location, cancellationToken);

        public Task<TerrainWindowResult> GetWindowAsync(TerrainWindowRequest request, CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            WindowCallCount++;

            var (centerX, centerY) = LunarProjection.ToProjected(request.CenterLocation.Latitude, request.CenterLocation.Longitude);
            int rad = Math.Max(1, request.WindowRadiusPixels);
            int size = (rad * 2) + 1;
            var grid = new float[size * size];
            bool hasNoData = false;

            for (int r = 0; r < size; r++)
            {
                double dy = (rad - r) * ResolutionMeters;
                for (int c = 0; c < size; c++)
                {
                    double dx = (c - rad) * ResolutionMeters;
                    float val = _heightAtProjectedMeters(centerX + dx, centerY + dy);
                    grid[(r * size) + c] = val;
                    if (float.IsNaN(val)) hasNoData = true;
                }
            }

            return Task.FromResult(new TerrainWindowResult(
                request.CenterLocation,
                size,
                size,
                ResolutionMeters,
                grid,
                null,
                null,
                hasNoData,
                Array.Empty<string>()));
        }
    }

    [Fact]
    public async Task FlatMoon_HorizonReflectsSphericalCurvatureDrop()
    {
        var terrain = new SyntheticTerrainService((_, _) => 0f);
        var service = new LolaHorizonService(terrain);
        var location = new TerrainLocation(-89.5, 0.0);

        var options = new HorizonOptions
        {
            AzimuthStepDeg = 45.0,
            MaxRangeMeters = 20_000.0,
            RayStepMeters = 100.0,
            ObserverHeightOffsetMeters = 0.0
        };

        var profile = await service.GetProfileAsync(location, options);

        Assert.True(profile.TerrainApplied);
        Assert.Equal(8, profile.Points.Count);
        // On a flat DEM with observer at 0 m, horizon dips slightly below 0 deg due to lunar curvature
        foreach (var pt in profile.Points)
        {
            Assert.InRange(pt.ElevationDeg, -0.5, -0.001);
        }
    }

    [Fact]
    public async Task IsolatedRidge_CreatesLocalizedElevationPeakAtTargetAzimuth()
    {
        // Observer at (-89.5, 0.0) -> projected (0, +15161.6m).
        // Local North (az=0) is +Y; Local East (az=90) is +X.
        var obs = new TerrainLocation(-89.5, 0.0);
        var (obsX, obsY) = LunarProjection.ToProjected(obs.Latitude, obs.Longitude);

        // Place a 600m tall ridge 4000m directly East (+X) of the observer
        var terrain = new SyntheticTerrainService((x, y) =>
        {
            double distToRidge = Math.Sqrt(Math.Pow(x - (obsX + 4000.0), 2) + Math.Pow(y - obsY, 2));
            return distToRidge < 400.0 ? 600.0f : 0.0f;
        });

        var service = new LolaHorizonService(terrain);
        var options = new HorizonOptions
        {
            AzimuthStepDeg = 10.0,
            MaxRangeMeters = 8_000.0,
            RayStepMeters = 80.0,
            ObserverHeightOffsetMeters = 2.0
        };

        var profile = await service.GetProfileAsync(obs, options);

        double eastHorizon = service.GetElevationAtAzimuth(profile, 90.0);
        double westHorizon = service.GetElevationAtAzimuth(profile, 270.0);
        double northHorizon = service.GetElevationAtAzimuth(profile, 0.0);

        // atan2(600 - 2 - curvature, 4000) ~ 8.4 deg
        Assert.InRange(eastHorizon, 7.0, 10.0);
        Assert.True(westHorizon < 0.0);
        Assert.True(northHorizon < 0.0);
    }

    [Fact]
    public async Task CloserRidge_ProducesHigherHorizonThanEqualHeightDistantRidge()
    {
        var obs = new TerrainLocation(-89.5, 0.0);
        var (obsX, obsY) = LunarProjection.ToProjected(obs.Latitude, obs.Longitude);

        // Near ridge (2 km North, +300 m) vs Far ridge (8 km South, +300 m)
        var terrain = new SyntheticTerrainService((x, y) =>
        {
            if (Math.Sqrt(Math.Pow(x - obsX, 2) + Math.Pow(y - (obsY + 2000.0), 2)) < 300.0) return 300f;
            if (Math.Sqrt(Math.Pow(x - obsX, 2) + Math.Pow(y - (obsY - 8000.0), 2)) < 300.0) return 300f;
            return 0f;
        });

        var service = new LolaHorizonService(terrain);
        var options = new HorizonOptions
        {
            AzimuthStepDeg = 90.0,
            MaxRangeMeters = 10_000.0,
            RayStepMeters = 80.0,
            ObserverHeightOffsetMeters = 2.0
        };

        var profile = await service.GetProfileAsync(obs, options);
        double northElev = service.GetElevationAtAzimuth(profile, 0.0);
        double southElev = service.GetElevationAtAzimuth(profile, 180.0);

        Assert.True(northElev > southElev, $"Near ridge ({northElev}°) must be higher than far ridge ({southElev}°)");
    }

    [Fact]
    public async Task CraterBowl_ProducesHighHorizonInAllDirections()
    {
        var obs = new TerrainLocation(-89.9, 45.0);
        var (obsX, obsY) = LunarProjection.ToProjected(obs.Latitude, obs.Longitude);

        // Circular crater of radius 3 km, floor at -1000m, rim at +500m
        var terrain = new SyntheticTerrainService((x, y) =>
        {
            double r = Math.Sqrt(Math.Pow(x - obsX, 2) + Math.Pow(y - obsY, 2));
            return r > 2800.0 ? 500.0f : -1000.0f;
        });

        var service = new LolaHorizonService(terrain);
        var options = new HorizonOptions
        {
            AzimuthStepDeg = 30.0,
            MaxRangeMeters = 5_000.0,
            RayStepMeters = 80.0
        };

        var profile = await service.GetProfileAsync(obs, options);
        Assert.All(profile.Points, pt => Assert.True(pt.ElevationDeg > 15.0));
    }

    [Fact]
    public void GetElevationAtAzimuth_WrapsSmoothlyAcross359To0Boundary()
    {
        var terrain = new SyntheticTerrainService((_, _) => 0f);
        var service = new LolaHorizonService(terrain);

        var profile = new HorizonProfileResult(
            new[]
            {
                new HorizonPoint(0.0, 10.0),
                new HorizonPoint(90.0, 2.0),
                new HorizonPoint(180.0, 2.0),
                new HorizonPoint(270.0, 2.0),
                new HorizonPoint(350.0, 6.0)
            },
            TerrainApplied: true,
            TerrainSource: "Synthetic",
            ResolutionMeters: 80.0,
            Warnings: Array.Empty<string>());

        double interpolated = service.GetElevationAtAzimuth(profile, 355.0);
        // Halfway between 350° (6.0°) and 0° (10.0°) -> 8.0°
        Assert.Equal(8.0, interpolated, precision: 3);

        // Negative and >360 azimuths should normalize identically
        Assert.Equal(8.0, service.GetElevationAtAzimuth(profile, -5.0), precision: 3);
        Assert.Equal(8.0, service.GetElevationAtAzimuth(profile, 715.0), precision: 3);
    }

    [Fact]
    public async Task ExactSouthPole_DoesNotProduceNaNOrDivideByZero()
    {
        var terrain = new SyntheticTerrainService((x, y) => (float)(0.01 * x));
        var service = new LolaHorizonService(terrain);
        var pole = new TerrainLocation(-90.0, 0.0);

        var profile = await service.GetProfileAsync(pole, new HorizonOptions
        {
            AzimuthStepDeg = 45.0,
            MaxRangeMeters = 2_000.0,
            RayStepMeters = 80.0
        });

        Assert.True(profile.TerrainApplied);
        Assert.Equal(8, profile.Points.Count);
        Assert.All(profile.Points, pt => Assert.True(double.IsFinite(pt.ElevationDeg)));
    }

    [Fact]
    public async Task CenterNoData_ReturnsUnavailableProfileWithWarning()
    {
        var terrain = new SyntheticTerrainService((_, _) => float.NaN);
        var service = new LolaHorizonService(terrain);

        var profile = await service.GetProfileAsync(new TerrainLocation(-89.5, 0.0));

        Assert.False(profile.TerrainApplied);
        Assert.Empty(profile.Points);
        Assert.Contains(profile.Warnings, w => w.Contains("NoData", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task CachingAndCancellation_WorkAsExpected()
    {
        var terrain = new SyntheticTerrainService((_, _) => 0f);
        var service = new LolaHorizonService(terrain);
        var loc = new TerrainLocation(-89.45, -137.31);
        var opts = new HorizonOptions { AzimuthStepDeg = 30.0, MaxRangeMeters = 2_000.0, RayStepMeters = 80.0 };

        await service.GetProfileAsync(loc, opts);
        await service.GetProfileAsync(loc, opts);
        Assert.Equal(1, terrain.WindowCallCount);

        using var cts = new CancellationTokenSource();
        cts.Cancel();
        await Assert.ThrowsAsync<OperationCanceledException>(() =>
            service.GetProfileAsync(new TerrainLocation(-89.1, 10.0), opts, cts.Token));
    }

    [Fact]
    public void Be06MapManifest_ExistsAndMatchesBackendValidationRules()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "public-assets")))
            dir = dir.Parent;
        Assert.NotNull(dir);

        string manifestPath = Path.Combine(dir!.FullName, "public-assets", "metadata", "map-manifest.json");
        Assert.True(File.Exists(manifestPath), $"BE-06 manifest missing: {manifestPath}");

        using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(manifestPath));
        JsonElement root = doc.RootElement;

        Assert.Equal(1, root.GetProperty("schemaVersion").GetInt32());
        JsonElement meta = root.GetProperty("metadata");
        Assert.Equal("lunar-south-pole", meta.GetProperty("regionId").GetString());
        Assert.Equal("south-polar-stereographic", meta.GetProperty("projection").GetProperty("name").GetString());
        Assert.Equal("MOON_ME", meta.GetProperty("projection").GetProperty("sourceFrame").GetString());
        Assert.Contains("+R=1737400", meta.GetProperty("projection").GetProperty("projDefinition").GetString());
        Assert.Equal("/terrain/0/0/0.glb", meta.GetProperty("assets").GetProperty("demoMeshUrl").GetString());
        Assert.True(meta.GetProperty("render").GetProperty("sceneTransform").GetProperty("validated").GetBoolean());
        Assert.True(meta.GetProperty("terrainDataset").GetProperty("metadataVerified").GetBoolean());
    }
}
