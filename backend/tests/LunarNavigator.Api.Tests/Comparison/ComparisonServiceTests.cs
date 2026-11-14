using LunarNavigator.Api.Tests.TestSupport;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Comparison;
using Xunit;
using static LunarNavigator.Api.Tests.TestSupport.ScientificTestData;

namespace LunarNavigator.Api.Tests.Comparison;

public sealed class ComparisonServiceTests
{
    private static CompareScenarioRequest Scenario(string id, AnalysisRequest? request = null)
    {
        var value = request ?? Request;
        return new CompareScenarioRequest(id, value.Location, value.Period, value.Options);
    }

    [Fact]
    public async Task Compare_IdenticalScenariosReuseAnalysis_AndAlwaysReturnAThenB()
    {
        var ephemeris = new StubEphemeris();
        using var analysis = CreateAnalysis(ephemeris);
        var result = await new ComparisonService(analysis, Policy).CompareAsync(new CompareRequest([Scenario("B"), Scenario("A")]));
        Assert.Equal(new[] { "A", "B" }, result.Scenarios.Select(scenario => scenario.Id));
        Assert.Equal(1, ephemeris.Calls);
        Assert.Equal(0, result.Differences.SunVisibleHours);
        Assert.Equal(3, result.Scenarios[0].Analysis.Samples.Count);
    }

    [Fact]
    public async Task Compare_DifferencesAreBMinusA_ForDifferentLocations()
    {
        using var analysis = CreateAnalysis(new StubEphemeris { Positions = (location, _) => (location.Longitude == 25 ? 1 : -1, 1) });
        var b = Request with { Location = new Coordinates(-88, 26) };
        var result = await new ComparisonService(analysis, Policy).CompareAsync(new CompareRequest([Scenario("A"), Scenario("B", b)]));
        Assert.Equal(-2, result.Differences.SunVisibleHours);
        Assert.Equal(0, result.Differences.EarthVisibleHours);
        Assert.Equal(-2, result.Differences.BothVisibleHours);
    }

    [Fact]
    public async Task Compare_DifferentDatesAndDurationsExposePeriodsPercentagesAndWarning()
    {
        using var analysis = CreateAnalysis();
        var b = Request with { Period = new AnalysisPeriod(Start.AddDays(1), Start.AddDays(1).AddHours(3), 60) };
        var result = await new ComparisonService(analysis, Policy).CompareAsync(new CompareRequest([Scenario("A"), Scenario("B", b)]));
        Assert.Equal(1, result.Differences.SunVisibleHours);
        Assert.All(result.Scenarios, scenario => Assert.Equal(100, scenario.Analysis.Summary.SunVisiblePercent));
        Assert.All(result.Scenarios, scenario => Assert.Contains(scenario.Analysis.Quality.Warnings, warning => warning.Contains("durations differ")));
    }

    [Fact]
    public async Task Compare_UnknownMetricsStayNull()
    {
        using var analysis = CreateAnalysis(terrain: new StubTerrain { Height = new TerrainHeightResult(null, null, null, null, false, []) });
        var result = await new ComparisonService(analysis, Policy).CompareAsync(new CompareRequest([Scenario("A"), Scenario("B")]));
        Assert.Null(result.Differences.SunVisibleHours);
        Assert.Null(result.Differences.BothVisibleHours);
        Assert.All(result.Scenarios, scenario => Assert.Equal("partial", scenario.Analysis.Status));
    }

    [Fact]
    public async Task Compare_ValidatesBothScenariosBeforeCallingExpensiveServices()
    {
        var ephemeris = new StubEphemeris();
        using var analysis = CreateAnalysis(ephemeris);
        var service = new ComparisonService(analysis, Policy);
        await Assert.ThrowsAsync<NavigationException>(() => service.CompareAsync(new CompareRequest([Scenario("A"), Scenario("A")])));
        await Assert.ThrowsAsync<NavigationException>(() => service.CompareAsync(new CompareRequest([
            Scenario("A"), Scenario("B", Request with { Period = Request.Period with { EndUtc = Start } })])));
        Assert.Equal(0, ephemeris.Calls);
    }

    [Fact]
    public async Task Compare_PropagatesFailureInsteadOfFabricatingSecondScenario()
    {
        using var analysis = CreateAnalysis(new StubEphemeris { Fail = true });
        var error = await Assert.ThrowsAsync<NavigationException>(() => new ComparisonService(analysis, Policy)
            .CompareAsync(new CompareRequest([Scenario("A"), Scenario("B")])));
        Assert.Equal("EPHEMERIS_UNAVAILABLE", error.Code);
    }
}
