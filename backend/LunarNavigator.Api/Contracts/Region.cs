namespace LunarNavigator.Api.Contracts;

/// <summary>Supported lunar coordinates in degrees, with east-positive longitude.</summary>
public sealed record Region(
    string Id,
    string Name,
    double LatitudeMin,
    double LatitudeMax,
    double LongitudeMin,
    double LongitudeMax);
