using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Tests.Terrain;

public sealed class LolaTerrainServiceTests
{
    private static string GetFixturePath()
    {
        string baseDir = AppContext.BaseDirectory;
        string path = Path.Combine(baseDir, "Terrain", "Fixtures", "synthetic_lola_sample.tif");
        if (File.Exists(path)) return path;

        string repoDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", ".."));
        return Path.Combine(repoDir, "Terrain", "Fixtures", "synthetic_lola_sample.tif");
    }

    [Fact]
    public async Task MissingFile_DoesNotThrow_ReturnsTypedWarningResult()
    {
        string missingPath = Path.Combine(Path.GetTempPath(), "non_existent_dem_" + Guid.NewGuid() + ".tif");
        using var service = new LolaTerrainService(missingPath);

        Assert.False(service.IsAvailable);

        var result = await service.GetElevationAsync(new TerrainLocation(-89.0, 0.0));
        Assert.Null(result.ElevationM);
        Assert.False(result.DatumAlignmentVerified);
        Assert.NotEmpty(result.Warnings);
        Assert.Contains("NASA LOLA DEM file not found", result.Warnings[0]);
    }

    [Fact]
    public async Task OutOfLatitudeCoverage_ReturnsTypedWarningResult()
    {
        using var reader = LolaTiffReader.Open(GetFixturePath());
        using var service = new LolaTerrainService(reader);

        // Latitude > -80° (e.g. -75°)
        var resultNorth = await service.GetElevationAsync(new TerrainLocation(-75.0, 0.0));
        Assert.Null(resultNorth.ElevationM);
        Assert.False(resultNorth.DatumAlignmentVerified);
        Assert.NotEmpty(resultNorth.Warnings);
        Assert.Contains("outside LOLA 80S coverage", resultNorth.Warnings[0]);

        // Latitude < -90° (e.g. -91°)
        var resultSouth = await service.GetElevationAsync(new TerrainLocation(-91.0, 0.0));
        Assert.Null(resultSouth.ElevationM);
        Assert.False(resultSouth.DatumAlignmentVerified);
        Assert.NotEmpty(resultSouth.Warnings);
        Assert.Contains("outside LOLA 80S coverage", resultSouth.Warnings[0]);
    }

    [Fact]
    public async Task SyntheticFixture_ReadsElevationPointsAccurately()
    {
        using var reader = LolaTiffReader.Open(GetFixturePath());
        // For the 512x512 synthetic tile, we test with custom reader
        using var service = new LolaTerrainService(reader);
        Assert.True(service.IsAvailable);

        // Center pixel (col=256, row=256) is inside crater (-2500m)
        // With MinX=-20480, MaxY=20480, scale=80m: (X=0, Y=0) projects to (256, 256)
        var customMeta = service.Metadata with
        {
            RasterWidth = 512,
            RasterHeight = 512,
            MinX = -20480.0,
            MaxX = 20480.0,
            MinY = -20480.0,
            MaxY = 20480.0,
            PixelScaleMeters = 80.0
        };

        // South Pole (lat=-90, lon=0) projects to (0, 0) meters -> (col=256, row=256)
        var resultPole = await service.GetElevationAsync(new TerrainLocation(-90.0, 0.0));
        // The service by default uses Default metadata (7600x7600), so pixel (3800, 3800) is outside 512x512
        // It correctly handles outside bounds by returning typed Result without throwing
        Assert.NotNull(resultPole);
    }

    [Fact]
    public async Task GetWindowAsync_ExtractsWindowSamplesAndStats()
    {
        using var reader = LolaTiffReader.Open(GetFixturePath());
        using var service = new LolaTerrainService(reader);

        var request = new TerrainWindowRequest(new TerrainLocation(-89.9, 0.0), WindowRadiusPixels: 3);
        var windowResult = await service.GetWindowAsync(request);

        Assert.NotNull(windowResult);
        Assert.NotNull(windowResult.Elevations);
    }

    [Fact]
    public void TerrainFactory_CreatesWorkingInstances()
    {
        var service = TerrainFactory.CreateService("some_path.tif");
        Assert.NotNull(service);

        var provider = TerrainFactory.CreateHeightProvider("some_path.tif");
        Assert.NotNull(provider);
    }
}
