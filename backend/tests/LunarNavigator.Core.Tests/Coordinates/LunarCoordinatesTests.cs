using System.Text.Json;
using Xunit;

namespace LunarNavigator.Core.Tests.Coordinates;

public class LunarCoordinatesTests
{
    private const double MoonRadiusMeters = 1737400.0;
    private const double ToleranceDegrees = 1e-6;
    private const double ToleranceMeters = 0.05;

    public record Geographic(double LatitudeDegrees, double LongitudeDegrees);
    public record Projected(double XMeters, double YMeters);

    public static (double x, double y) ToProjected(double latDeg, double lonDeg)
    {
        double colatDeg = 90.0 + latDeg;
        double colatRad = colatDeg * Math.PI / 180.0;
        double rho = 2.0 * MoonRadiusMeters * Math.Tan(colatRad / 2.0);
        double lonRad = lonDeg * Math.PI / 180.0;
        double x = rho * Math.Sin(lonRad);
        double y = rho * Math.Cos(lonRad);
        return (x, y);
    }

    public static (double lat, double lon) ToGeographic(double x, double y)
    {
        double rho = Math.Sqrt(x * x + y * y);
        if (rho < 1e-9)
        {
            return (-90.0, 0.0);
        }

        double c = 2.0 * Math.Atan(rho / (2.0 * MoonRadiusMeters));
        double lat = c * 180.0 / Math.PI - 90.0;
        double lon = Math.Atan2(x, y) * 180.0 / Math.PI;
        return (lat, lon);
    }

    [Fact]
    public void SouthPole_ConvertsToOrigin_AndBack()
    {
        var (x, y) = ToProjected(-90.0, 0.0);
        Assert.Equal(0.0, x, 6);
        Assert.Equal(0.0, y, 6);

        var (lat, lon) = ToGeographic(0.0, 0.0);
        Assert.Equal(-90.0, lat, 6);
        Assert.Equal(0.0, lon, 6);
    }

    [Theory]
    [InlineData(-89.45, -137.31, -11308.23, -12258.89)] // Connecting Ridge
    [InlineData(-89.90, 0.0, 0.0, 3032.32)]             // Shackleton Rim
    [InlineData(-85.99, -3.0, -6366.52, 121479.59)]     // Malapert Mountain
    [InlineData(-87.31, 77.02, 79500.19, 18324.84)]     // Faustini Rim A
    [InlineData(-87.40, -5.1, -7009.69, 78542.06)]      // Haworth Rim
    [InlineData(-84.50, 82.8, 165590.46, 20918.91)]     // Amundsen Rim
    public void ControlPoints_MatchProjectedValues(double lat, double lon, double expectedX, double expectedY)
    {
        var (x, y) = ToProjected(lat, lon);
        Assert.InRange(Math.Abs(x - expectedX), 0.0, ToleranceMeters);
        Assert.InRange(Math.Abs(y - expectedY), 0.0, ToleranceMeters);

        var (roundtripLat, roundtripLon) = ToGeographic(x, y);
        Assert.InRange(Math.Abs(roundtripLat - lat), 0.0, ToleranceDegrees);
        Assert.InRange(Math.Abs(roundtripLon - lon), 0.0, ToleranceDegrees);
    }

    [Fact]
    public void FixtureFile_ExistsAndIsValidJson()
    {
        var fixturePath = Path.Combine(AppContext.BaseDirectory, "Fixtures", "coordinate-control-points.json");

        Assert.True(File.Exists(fixturePath), $"Fixture file must exist at {fixturePath}");

        var json = File.ReadAllText(fixturePath);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal("LunarCoordinateControlPoints", root.GetProperty("title").GetString());
        var points = root.GetProperty("controlPoints");
        Assert.True(points.GetArrayLength() >= 8, "Must contain at least 8 control points");
    }
}
