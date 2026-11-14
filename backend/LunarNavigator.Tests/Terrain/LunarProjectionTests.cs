using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Tests.Terrain;

public sealed class LunarProjectionTests
{
    private const double ToleranceMeters = 0.05;
    private const double ToleranceDegrees = 1e-6;

    [Fact]
    public void SouthPole_ConvertsToZeroMeters_AndOriginPixel()
    {
        var (x, y) = LunarProjection.ToProjected(-90.0, 0.0);
        Assert.Equal(0.0, x, 6);
        Assert.Equal(0.0, y, 6);

        var (lat, lon) = LunarProjection.ToGeographic(0.0, 0.0);
        Assert.Equal(-90.0, lat, 6);
        Assert.Equal(0.0, lon, 6);

        var (col, row) = LunarProjection.ToPixel(0.0, 0.0, LolaDemMetadata.Default);
        Assert.Equal(3800.0, col, 6);
        Assert.Equal(3800.0, row, 6);

        var (backX, backY) = LunarProjection.FromPixel(3800.0, 3800.0, LolaDemMetadata.Default);
        Assert.Equal(0.0, backX, 6);
        Assert.Equal(0.0, backY, 6);
    }

    [Theory]
    [InlineData(-89.45, -137.31, -11308.23, -12258.89)] // Connecting Ridge (CR1)
    [InlineData(-89.90, 0.0, 0.0, 3032.32)]             // Shackleton Rim
    [InlineData(-85.99, -3.0, -6366.52, 121479.59)]     // Malapert Mountain (Massif)
    [InlineData(-87.31, 77.02, 79500.19, 18324.84)]     // Faustini Rim A
    [InlineData(-87.40, -5.1, -7009.69, 78542.06)]      // Haworth Rim
    [InlineData(-84.50, 82.8, 165590.46, 20918.91)]     // Amundsen Rim
    public void ControlPoints_ProjectWithinTolerance(
        double lat, double lon, double expectedX, double expectedY)
    {
        var (x, y) = LunarProjection.ToProjected(lat, lon);
        Assert.InRange(Math.Abs(x - expectedX), 0.0, ToleranceMeters);
        Assert.InRange(Math.Abs(y - expectedY), 0.0, ToleranceMeters);

        var (roundLat, roundLon) = LunarProjection.ToGeographic(x, y);
        Assert.InRange(Math.Abs(roundLat - lat), 0.0, ToleranceDegrees);
        Assert.InRange(Math.Abs(roundLon - lon), 0.0, ToleranceDegrees);
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(180.0)]
    [InlineData(-180.0)]
    [InlineData(360.0)]
    [InlineData(-90.0)]
    [InlineData(270.0)]
    public void LongitudeWrapping_ProducesConsistentProjections(double lon)
    {
        // Lat = -85.0
        var (x1, y1) = LunarProjection.ToProjected(-85.0, lon);
        var (roundLat, roundLon) = LunarProjection.ToGeographic(x1, y1);

        Assert.Equal(-85.0, roundLat, 4);

        // Normalized longitude in [-180, 180]
        double expectedNormLon = lon switch
        {
            360.0 => 0.0,
            270.0 => -90.0,
            -180.0 => -180.0,
            180.0 => 180.0,
            _ => lon
        };
        Assert.Equal(expectedNormLon, roundLon, 4);
    }

    [Fact]
    public void HorizonsHeightMapping_ConvertsMetersToKilometers()
    {
        double elevMeters = 1450.5;
        double heightKm = LunarProjection.ElevationToHorizonsHeightKm(elevMeters);
        Assert.Equal(1.4505, heightKm, 6);

        double negativeElevM = -2500.0;
        double negKm = LunarProjection.ElevationToHorizonsHeightKm(negativeElevM);
        Assert.Equal(-2.5, negKm, 6);
    }
}
