using LunarNavigator.Api.Tests.TestSupport;
using LunarNavigator.Core.Analysis;
using Xunit;
using static LunarNavigator.Api.Tests.TestSupport.ScientificTestData;

namespace LunarNavigator.Api.Tests.Analysis;

public sealed class AnalysisServiceTests
{
    [Fact]
    public async Task Analyze_UsesVerifiedAltitudeAndTerrain_AndCachesOnlyHorizon()
    {
        var ephemeris = new StubEphemeris();
        var terrain = new StubTerrain();
        using var service = CreateAnalysis(ephemeris, terrain);
        var result = await service.AnalyzeAsync(Request);
        await service.AnalyzeAsync(Request);
        Assert.Equal("complete", result.Status);
        Assert.Equal(0.12, ephemeris.LastAltitudeKm, 10);
        Assert.Equal(2, ephemeris.Calls);
        Assert.Equal(1, terrain.ProfileCalls);
        Assert.Equal(3, result.Samples.Count);
        Assert.Equal(Request.Period.EndUtc, result.Samples[^1].TimeUtc);
        Assert.All(result.Samples, sample => { Assert.True(sample.Sun.Visible); Assert.False(sample.Earth.Visible); });
        Assert.Equal(2, result.Summary.SunVisibleHours);
        Assert.Equal(100, result.Summary.SunVisiblePercent);
        Assert.Equal(0, result.Summary.EarthVisibleHours);
        Assert.Equal(0, result.Summary.BothVisibleHours);
        Assert.Equal(360, result.Horizon!.Points.Count);
    }

    [Fact]
    public async Task Analyze_InterpolatesCrossingsAndIntersectsIntervals()
    {
        var ephemeris = new StubEphemeris
        {
            Positions = (_, time) => ((time - Start).TotalHours < 1 ? -1 : 1, (time - Start).TotalHours < 2 ? 1 : -1)
        };
        using var service = CreateAnalysis(ephemeris);
        var result = await service.AnalyzeAsync(Request);
        Assert.Equal(Start.AddMinutes(30), Assert.Single(result.Intervals.SunVisible).StartUtc);
        Assert.Equal(Start.AddMinutes(90), Assert.Single(result.Intervals.EarthVisible).EndUtc);
        Assert.Equal(1.5, result.Summary.SunVisibleHours);
        Assert.Equal(1.5, result.Summary.EarthVisibleHours);
        Assert.Equal(1, result.Summary.BothVisibleHours);
        Assert.Equal(75, result.Summary.SunVisiblePercent);
    }

    [Fact]
    public async Task Analyze_NeverClaimsVisibilityWithoutVerifiedTerrain()
    {
        var terrain = new StubTerrain { Height = new TerrainHeightResult(null, null, null, null, false, ["Unavailable test terrain"]) };
        var ephemeris = new StubEphemeris();
        using var service = CreateAnalysis(ephemeris, terrain);
        var result = await service.AnalyzeAsync(Request);
        Assert.Equal("partial", result.Status);
        Assert.False(result.Quality.TerrainApplied);
        Assert.Null(result.Location.ElevationM);
        Assert.Null(result.Summary.SunVisibleHours);
        Assert.Null(result.Summary.BothVisibleHours);
        Assert.Null(result.Horizon);
        Assert.Empty(result.Intervals.SunVisible);
        Assert.All(result.Samples, sample => { Assert.Null(sample.Sun.Visible); Assert.Null(sample.Earth.Visible); Assert.Null(sample.Sun.ClearanceDeg); });
        Assert.Equal(0, ephemeris.LastAltitudeKm);
        Assert.Contains(result.Quality.Warnings, warning => warning.Contains("approximated"));
    }

    [Fact]
    public async Task Analyze_RefusesUnmappedDatumEvenIfProviderSetsAlignmentFlag()
    {
        var original = new StubTerrain();
        var terrain = new StubTerrain { Height = original.Height with { VerticalReference = "UNMAPPED DATUM" } };
        using var service = CreateAnalysis(terrain: terrain);
        Assert.Equal("partial", (await service.AnalyzeAsync(Request)).Status);
        Assert.Equal(0, terrain.ProfileCalls);
    }

    [Fact]
    public async Task Analyze_RejectsIncompleteOrMismatchedHorizon()
    {
        foreach (var profile in new[]
        {
            new StubTerrain().Profile with { Points = [new HorizonPoint(0, 0), new HorizonPoint(180, 0)] },
            new StubTerrain().Profile with { TerrainSource = "DIFFERENT TEST DATASET" },
            new StubTerrain().Profile with { ResolutionMeters = 40 },
            new StubTerrain().Profile with { Points = Enumerable.Repeat(new HorizonPoint(0, 0), 360).ToArray() }
        })
        {
            using var service = CreateAnalysis(terrain: new StubTerrain { Profile = profile });
            var result = await service.AnalyzeAsync(Request);
            Assert.Equal("partial", result.Status);
            Assert.All(result.Samples, sample => Assert.Null(sample.Sun.Visible));
        }
    }

    [Fact]
    public async Task Analyze_IncludeHorizonFalse_DoesNotDisableTerrainCalculations()
    {
        using var service = CreateAnalysis();
        var result = await service.AnalyzeAsync(Request with { Options = new AnalysisOptions(IncludeHorizon: false) });
        Assert.True(result.Quality.TerrainApplied);
        Assert.Null(result.Horizon);
        Assert.Equal(2, result.Summary.SunVisibleHours);
    }

    [Fact]
    public async Task Analyze_ExactPoleRemainsPartialUntilMeridianConventionIsReviewed()
    {
        using var service = CreateAnalysis();
        var result = await service.AnalyzeAsync(Request with { Location = new Coordinates(-90, 0) });
        Assert.Equal("partial", result.Status);
        Assert.Contains(result.Quality.Warnings, warning => warning.Contains("exact pole"));
    }

    [Fact]
    public async Task Analyze_ZeroClearanceIsNotVisible_AndMissingSampleFails()
    {
        using var zero = CreateAnalysis(new StubEphemeris { Positions = (_, _) => (0, 0) });
        var result = await zero.AnalyzeAsync(Request);
        Assert.All(result.Samples, sample => Assert.False(sample.Sun.Visible));
        Assert.Equal(0, result.Summary.SunVisibleHours);
        using var missing = CreateAnalysis(new StubEphemeris { OmitTerminalSample = true });
        Assert.Equal("EPHEMERIS_UNAVAILABLE", (await Assert.ThrowsAsync<NavigationException>(() => missing.AnalyzeAsync(Request))).Code);
    }

    [Fact]
    public async Task Analyze_PreservesCancellation()
    {
        using var service = CreateAnalysis();
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => service.AnalyzeAsync(Request, cancellation.Token));
    }

    [Fact]
    public void HorizonInterpolation_WrapsThroughNorth()
    {
        HorizonPoint[] points = [new(10, 2), new(350, 4)];
        Assert.Equal(3, VisibilityCalculator.InterpolateHorizon(points, 0), 10);
        Assert.Equal(3.1, VisibilityCalculator.InterpolateHorizon(points, 359), 10);
    }
}
