namespace LunarNavigator.Api.Contracts;

/// <summary>Configured bounds for analysis sampling and scenario count.</summary>
public sealed record AnalysisLimits(int MinStepMinutes, int MaxStepMinutes, int MaxSamples, int MaxScenarios);
