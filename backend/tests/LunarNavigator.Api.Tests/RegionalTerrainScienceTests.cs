using LunarNavigator.Api.Tests.TestSupport;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Horizon;
using LunarNavigator.Core.Terrain;
using Xunit;
using static LunarNavigator.Api.Tests.TestSupport.ScientificTestData;

namespace LunarNavigator.Api.Tests;

public sealed class RegionalTerrainScienceTests
{
    [Theory]
    [InlineData(false, false, false)]
    [InlineData(false, true, false)]
    [InlineData(true, false, false)]
    [InlineData(false, false, true)]
    public async Task RegionalModel_NeverConvertsClearOrBlockedOrClippedSamplesToGlobalVisibility(bool clipped, bool blocked, bool noData)
    {
        var terrain = new RegionalTestTerrain(clipped, blocked, noData);
        var heights = new StubTerrain { Height = new(0,"REGIONAL TEST",ObserverAltitudeResolver.HorizonsDatum,80,true,[]) };
        var ephemeris = new StubEphemeris();
        using var service = new AnalysisService(ephemeris, heights,
            new LolaHorizonService(terrain, new HorizonOptions { MaxRangeMeters = 5000, ObserverHeightOffsetMeters = 0 }),
            new ObserverAltitudeResolver(), Policy);
        var result = await service.AnalyzeAsync(Request);
        Assert.Equal("partial", result.Status);
        Assert.False(result.Quality.TerrainApplied);
        Assert.Null(result.Summary.SunVisibleHours);
        Assert.Empty(result.Intervals.SunVisible);
        Assert.All(result.Samples, sample => { Assert.Null(sample.Sun.Visible); Assert.Null(sample.Earth.Visible); });
        if (clipped || noData)
        {
            Assert.Null(result.Horizon);
            Assert.All(result.Samples, sample => Assert.Null(sample.Sun.ClearanceDeg));
        }
        else
        {
            Assert.Equal(360, result.Horizon!.Points.Count);
            Assert.All(result.Samples, sample =>
            {
                Assert.NotNull(sample.Sun.ClearanceDeg);
                Assert.Equal(!blocked, sample.Sun.ClearanceDeg > 0);
            });
        }
    }

    [Theory]
    [InlineData(1962, true)]
    [InlineData(2649, true)]
    [InlineData(2650, false)]
    [InlineData(2700, false)]
    public async Task DatumEpochGate_StopsUnreviewedFuturePeriods(int year, bool expectedAligned)
    {
        var start = new DateTimeOffset(year,1,1,0,0,0,TimeSpan.Zero);
        var ephemeris = new StubEphemeris();
        var terrain = new StubTerrain();
        using var service = CreateAnalysis(ephemeris,terrain);
        var result = await service.AnalyzeAsync(Request with { Period = new(start,start.AddMinutes(10),10) });
        Assert.Equal(expectedAligned ? 0.12 : 0, ephemeris.LastAltitudeKm);
        Assert.Equal(expectedAligned ? 1 : 0, terrain.ProfileCalls);
        if (!expectedAligned)
        {
            Assert.Equal("partial",result.Status);
            Assert.Null(result.Horizon);
            Assert.All(result.Samples,s => Assert.Null(s.Sun.ClearanceDeg));
        }
    }

    private sealed class RegionalTestTerrain(bool clipped, bool blocked, bool noData) : ITerrainService
    {
        public bool IsAvailable => true;
        public Task<TerrainHeightResult> GetHeightAsync(TerrainLocation location, CancellationToken cancellationToken = default) => GetElevationAsync(location,cancellationToken);
        public Task<TerrainHeightResult> GetElevationAsync(TerrainLocation location, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TerrainHeightResult(0,"REGIONAL TEST",ObserverAltitudeResolver.HorizonsDatum,80,true,[]));
        public Task<TerrainWindowResult> GetWindowAsync(TerrainWindowRequest request, CancellationToken cancellationToken = default)
        {
            int size = clipped ? 5 : request.WindowRadiusPixels * 2 + 1;
            // Synthetic raised plateau around the observer, or constant-radius sphere.
            var grid = Enumerable.Repeat(blocked ? 100f : 0f,size*size).ToArray();
            grid[(size/2)*size+size/2] = 0;
            if (noData) grid[(size/2)*size+size/2+1] = float.NaN;
            return Task.FromResult(new TerrainWindowResult(request.CenterLocation,size,size,80,grid,0,blocked ? 100 : 0,false,[]));
        }
    }
}
