namespace LunarNavigator.Core.Ephemeris;

public sealed record EphemerisResponse(
    string ReferenceFrame, string VectorConvention, IReadOnlyList<EphemerisSample> Samples, EphemerisQuality Quality);
