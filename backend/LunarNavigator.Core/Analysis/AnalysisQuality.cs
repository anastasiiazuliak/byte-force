namespace LunarNavigator.Core.Analysis;

public sealed record AnalysisQuality(
    string EphemerisSource, string? TerrainSource, bool TerrainApplied, double? TerrainResolutionMeters,
    string VisibilityMethod, IReadOnlyList<string> Warnings);
