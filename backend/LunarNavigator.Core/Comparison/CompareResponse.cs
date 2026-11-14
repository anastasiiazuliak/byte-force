namespace LunarNavigator.Core.Comparison;

public sealed record CompareResponse(IReadOnlyList<CompareScenarioResponse> Scenarios, ComparisonDifferences Differences);
