namespace LunarNavigator.Api.Contracts;

/// <summary>Scientific features currently available in the API.</summary>
public sealed record Features(
    bool TerrainAnalysis,
    bool ScenarioComparison,
    bool HorizonProfile,
    bool MoonFixedEphemeris);
