using System.Text.Json.Serialization;
using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Ephemeris;

public sealed record EphemerisRequest(
    [property: JsonRequired] DateTimeOffset StartUtc,
    [property: JsonRequired] DateTimeOffset EndUtc,
    [property: JsonRequired] int StepMinutes)
{
    public AnalysisPeriod ToPeriod() => new(StartUtc, EndUtc, StepMinutes);
}
