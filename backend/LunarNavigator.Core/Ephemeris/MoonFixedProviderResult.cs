namespace LunarNavigator.Core.Ephemeris;

public sealed record MoonFixedProviderResult(
    bool FrameVerified, string ReferenceFrame, string VectorConvention,
    IReadOnlyList<EphemerisSample> Samples, EphemerisQuality Quality);
