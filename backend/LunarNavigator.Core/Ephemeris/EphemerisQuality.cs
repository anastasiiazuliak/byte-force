namespace LunarNavigator.Core.Ephemeris;

public sealed record EphemerisQuality(string Source, IReadOnlyList<string> Warnings);
