namespace LunarNavigator.Core.Terrain;

/// <summary>
/// Mathematical transformations for the Lunar South Polar Stereographic projection (ARC-03 / DATA-01).
/// Reference frame: Moon (2015) - Sphere / Ocentric / South Polar.
/// Datum: Sphere with radius R = 1,737,400.0 meters (1,737.4 km).
/// Standard parallel: -90.0° (true scale at South Pole, k0 = 1.0).
/// Central meridian: 0.0° (Reference Meridian along +Y).
/// </summary>
public static class LunarProjection
{
    public const double MoonRadiusMeters = 1737400.0;
    public const double SouthPoleLatitude = -90.0;
    public const double CentralMeridianLongitude = 0.0;

    /// <summary>
    /// Converts lunar geographic coordinates (lat, lon in degrees) to South Polar Stereographic projected coordinates (X, Y in meters).
    /// </summary>
    /// <param name="latitudeDeg">Latitude in degrees [-90.0, -80.0].</param>
    /// <param name="longitudeDeg">Longitude in degrees [-180.0, 180.0] or [0.0, 360.0].</param>
    /// <returns>Projected (X, Y) coordinates in meters.</returns>
    public static (double X, double Y) ToProjected(double latitudeDeg, double longitudeDeg)
    {
        // Colatitude: distance from the South Pole (0° at south pole, 10° at 80°S)
        double colatDeg = 90.0 + latitudeDeg;
        if (colatDeg <= 0.0)
        {
            return (0.0, 0.0);
        }

        double colatRad = colatDeg * (Math.PI / 180.0);
        double rho = 2.0 * MoonRadiusMeters * Math.Tan(colatRad / 2.0);

        double lonRad = longitudeDeg * (Math.PI / 180.0);
        double x = rho * Math.Sin(lonRad);
        double y = rho * Math.Cos(lonRad);

        return (x, y);
    }

    /// <summary>
    /// Converts projected coordinates (X, Y in meters) back to geographic (lat, lon in degrees).
    /// </summary>
    public static (double Latitude, double Longitude) ToGeographic(double x, double y)
    {
        double rho = Math.Sqrt(x * x + y * y);
        if (rho < 1e-9)
        {
            return (SouthPoleLatitude, CentralMeridianLongitude);
        }

        double c = 2.0 * Math.Atan(rho / (2.0 * MoonRadiusMeters));
        double lat = (c * (180.0 / Math.PI)) - 90.0;
        double lon = Math.Atan2(x, y) * (180.0 / Math.PI);

        return (lat, lon);
    }

    /// <summary>
    /// Converts projected coordinates (X, Y in meters) to floating-point raster pixel coordinates (col, row).
    /// </summary>
    public static (double Col, double Row) ToPixel(double x, double y, LolaDemMetadata metadata)
    {
        double col = (x - metadata.MinX) / metadata.PixelScaleMeters;
        double row = (metadata.MaxY - y) / metadata.PixelScaleMeters;
        return (col, row);
    }

    /// <summary>
    /// Converts raster pixel coordinates (col, row) to projected coordinates (X, Y in meters) at pixel center.
    /// </summary>
    public static (double X, double Y) FromPixel(double col, double row, LolaDemMetadata metadata)
    {
        double x = metadata.MinX + (col * metadata.PixelScaleMeters);
        double y = metadata.MaxY - (row * metadata.PixelScaleMeters);
        return (x, y);
    }

    /// <summary>
    /// Maps surface elevation in meters relative to reference sphere (R=1737.4 km)
    /// to kilometers above reference surface as required by JPL Horizons SITE_COORD (heightKm).
    /// </summary>
    public static double ElevationToHorizonsHeightKm(double elevationMeters)
    {
        return elevationMeters / 1000.0;
    }
}
