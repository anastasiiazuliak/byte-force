using System.Text.Json.Serialization;
using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Comparison;

public sealed record CompareScenarioRequest(
    [property: JsonRequired] string Id,
    [property: JsonRequired] Coordinates Location,
    [property: JsonRequired] AnalysisPeriod Period,
    AnalysisOptions? Options = null);
