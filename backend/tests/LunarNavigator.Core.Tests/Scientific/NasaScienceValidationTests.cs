using System.Text.Json;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Core.Tests.Scientific;

public class NasaScienceValidationTests
{
    private const string FixtureRelativePath = "contracts/fixtures/science-checks/nasa-science-benchmarks.json";

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "contracts")) &&
                Directory.Exists(Path.Combine(dir.FullName, "docs")))
            {
                return dir.FullName;
            }
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Could not locate repository root.");
    }

    private static JsonDocument LoadBenchmarks()
    {
        string root = FindRepoRoot();
        string fullPath = Path.Combine(root, FixtureRelativePath);
        Assert.True(File.Exists(fullPath), $"Benchmark fixture not found: {fullPath}");
        return JsonDocument.Parse(File.ReadAllText(fullPath));
    }

    [Fact]
    public void ControlPoints_MatchNasaDemGroundTruth_AndStereographicMath()
    {
        using JsonDocument doc = LoadBenchmarks();
        JsonElement controlPoints = doc.RootElement.GetProperty("controlPoints");

        foreach (JsonElement cp in controlPoints.EnumerateArray())
        {
            string id = cp.GetProperty("id").GetString()!;
            double lat = cp.GetProperty("geographic").GetProperty("latitudeDegrees").GetDouble();
            double lon = cp.GetProperty("geographic").GetProperty("longitudeDegrees").GetDouble();
            double expectedX = cp.GetProperty("projected").GetProperty("xMeters").GetDouble();
            double expectedY = cp.GetProperty("projected").GetProperty("yMeters").GetDouble();

            var (projX, projY) = LunarProjection.ToProjected(lat, lon);
            Assert.True(Math.Abs(projX - expectedX) < 1.0, $"{id} X projected error exceeds tolerance: {projX} vs {expectedX}");
            Assert.True(Math.Abs(projY - expectedY) < 1.0, $"{id} Y projected error exceeds tolerance: {projY} vs {expectedY}");

            var (roundTripLat, roundTripLon) = LunarProjection.ToGeographic(projX, projY);
            Assert.True(Math.Abs(roundTripLat - lat) < 1e-5, $"{id} Lat round-trip error exceeds tolerance");
            Assert.True(Math.Abs(roundTripLon - lon) < 1e-5, $"{id} Lon round-trip error exceeds tolerance");
        }
    }

    [Fact]
    public void HorizonInvariants_HigherTerrainOccludesLowElevationSunlight()
    {
        // Low solar elevation near polar ridge: Sun at +1.25 deg elevation, azimuth 142.5 deg.
        // Local terrain rim is at +1.40 deg elevation.
        var horizonPoints = new List<HorizonPoint>
        {
            new(0.0, 1.1),
            new(90.0, 0.8),
            new(142.5, 1.4),
            new(180.0, 2.2),
            new(270.0, 1.6)
        };

        double sunAzimuth = 142.5;
        double sunElevation = 1.25;

        double localHorizon = VisibilityCalculator.InterpolateHorizon(horizonPoints, sunAzimuth);
        double clearance = sunElevation - localHorizon;

        Assert.Equal(1.4, localHorizon, precision: 3);
        Assert.True(clearance < 0.0, "Sun must be occluded by ridge terrain despite positive skyward elevation");
    }

    [Fact]
    public void CraterFloor_PermanentlyShadowedRegion_HasNegativeClearanceYearRound()
    {
        // Shackleton crater floor (SCI-03): crater walls subtend 18-22 deg above local horizontal.
        var craterRimHorizon = new List<HorizonPoint>
        {
            new(0.0, 18.5),
            new(62.5, 22.0),
            new(120.0, 20.4),
            new(240.0, 19.1)
        };

        // Even at maximum lunar polar solar elevation (~1.55 deg), clearance must remain deeply negative.
        double maxSolarElevation = 1.55;

        foreach (double az in new[] { 0.0, 45.0, 62.5, 90.0, 120.0, 180.0, 240.0, 315.0 })
        {
            double rimElevation = VisibilityCalculator.InterpolateHorizon(craterRimHorizon, az);
            double clearance = maxSolarElevation - rimElevation;
            Assert.True(clearance < -15.0, $"PSR at azimuth {az} deg must be occluded (clearance={clearance})");
        }
    }

    [Fact]
    public void VisibilityClearance_CrossingInterpolation_AccuratelyFindsSunrise()
    {
        var t0 = new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero);
        var t1 = t0.AddHours(1);

        // Clearance goes from -0.5 (shadow) to +0.5 (sunlight) linearly
        var sample0 = new AnalysisSample(
            t0,
            new BodyPosition(140.0, 0.9, 1.4, -0.5, false),
            new BodyPosition(40.0, 5.0, 1.0, 4.0, true));

        var sample1 = new AnalysisSample(
            t1,
            new BodyPosition(141.0, 1.9, 1.4, 0.5, true),
            new BodyPosition(40.5, 5.1, 1.0, 4.1, true));

        var intervals = VisibilityCalculator.GetIntervals(new[] { sample0, sample1 }, s => s.Sun);

        Assert.Single(intervals);
        // Crossing should happen at exactly the half-way point: t0 + 30 minutes
        Assert.Equal(t0.AddMinutes(30), intervals[0].StartUtc);
        Assert.Equal(t1, intervals[0].EndUtc);
    }
}
