using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Analysis;

/// <summary>UTC interval with an explicit terminal sample for integration of [start,end).</summary>
public sealed record AnalysisPeriod(
    [property: JsonRequired] DateTimeOffset StartUtc,
    [property: JsonRequired] DateTimeOffset EndUtc,
    [property: JsonRequired] int StepMinutes);
