namespace LunarNavigator.Models;

/// <summary>
/// Airless apparent positions of the target centers relative to the ideal local horizon.
/// All angles are in degrees. Azimuth increases clockwise from north (0) through east (90).
/// Positive elevation does not establish visibility through local terrain.
/// </summary>
public sealed record LunarObservation(
    DateTimeOffset Time,
    double SunElevationDegrees,
    double SunAzimuthDegrees,
    double EarthElevationDegrees,
    double EarthAzimuthDegrees);
