namespace LunarNavigator.Core.Analysis;

/// <summary>Limits shared by analysis, comparison and ephemeris.</summary>
public sealed record AnalysisPolicy(int MinStepMinutes = 10, int MaxStepMinutes = 1440, int MaxSamples = 2000);
