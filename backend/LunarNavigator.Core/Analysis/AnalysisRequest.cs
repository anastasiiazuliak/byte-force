using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Analysis;

public sealed record AnalysisRequest(
    [property: JsonRequired] Coordinates Location,
    [property: JsonRequired] AnalysisPeriod Period,
    AnalysisOptions? Options = null);
