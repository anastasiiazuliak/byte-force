namespace LunarNavigator.Core.Ephemeris;

public sealed record EphemerisSample(DateTimeOffset TimeUtc, IReadOnlyList<double> SunDirection, IReadOnlyList<double> EarthDirection);
