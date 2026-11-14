using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Api.Tests.TestSupport;

internal static class ScientificTestData
{
    public static DateTimeOffset Start { get; } = new(2026, 11, 14, 0, 0, 0, TimeSpan.Zero);
    public static AnalysisRequest Request { get; } = new(new Coordinates(-89, 25), new AnalysisPeriod(Start, Start.AddHours(2), 60));
    public static AnalysisPolicy Policy { get; } = new();

    public static AnalysisService CreateAnalysis(StubEphemeris? ephemeris = null, StubTerrain? terrain = null)
    {
        var data = terrain ?? new StubTerrain();
        return new AnalysisService(ephemeris ?? new StubEphemeris(), data, data, new ObserverAltitudeResolver(), Policy);
    }
}
