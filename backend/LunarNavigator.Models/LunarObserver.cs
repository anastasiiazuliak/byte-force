namespace LunarNavigator.Models;

/// <summary>A site in the Moon's mean-Earth reference frame, not terrestrial WGS84.</summary>
public sealed record LunarObserver
{
    public double LatitudeDegrees { get; }
    public double LongitudeDegreesEast { get; }

    /// <summary>Altitude above the Horizons lunar reference sphere (radius 1737.4 km).</summary>
    public double AltitudeKilometers { get; }

    public LunarObserver(double latitudeDegrees, double longitudeDegreesEast, double altitudeKilometers = 0)
    {
        if (!double.IsFinite(latitudeDegrees) || latitudeDegrees is < -90 or > 90)
            throw new ArgumentOutOfRangeException(nameof(latitudeDegrees));
        if (!double.IsFinite(longitudeDegreesEast) || longitudeDegreesEast is < -180 or > 360)
            throw new ArgumentOutOfRangeException(nameof(longitudeDegreesEast));
        if (!double.IsFinite(altitudeKilometers) || altitudeKilometers <= -1737.4)
            throw new ArgumentOutOfRangeException(nameof(altitudeKilometers));

        LatitudeDegrees = latitudeDegrees;
        LongitudeDegreesEast = longitudeDegreesEast;
        AltitudeKilometers = altitudeKilometers;
    }
}
