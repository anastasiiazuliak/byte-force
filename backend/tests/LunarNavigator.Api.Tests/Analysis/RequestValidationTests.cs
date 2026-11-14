using LunarNavigator.Core.Analysis;
using Xunit;
using static LunarNavigator.Api.Tests.TestSupport.ScientificTestData;

namespace LunarNavigator.Api.Tests.Analysis;

public sealed class RequestValidationTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(1441)]
    public void Period_RejectsStepsOutsideConfiguredLimits(int step) =>
        Assert.Equal("VALIDATION_ERROR", Assert.Throws<NavigationException>(() =>
            RequestValidation.ValidatePeriod(Request.Period with { StepMinutes = step }, Policy)).Code);

    [Fact]
    public void Period_CountsTerminalSampleAndShortFinalStep()
    {
        var period = new AnalysisPeriod(Start, Start.AddMinutes(100), 60);
        Assert.Equal(new[] { Start, Start.AddHours(1), Start.AddMinutes(100) }, RequestValidation.SampleTimes(period));
        Assert.Throws<NavigationException>(() => RequestValidation.ValidatePeriod(period, Policy with { MaxSamples = 2 }));
        RequestValidation.ValidatePeriod(period, Policy with { MaxSamples = 3 });
        Assert.Throws<NavigationException>(() => RequestValidation.ValidatePeriod(period with { EndUtc = Start }, Policy));
        Assert.Throws<NavigationException>(() => RequestValidation.ValidatePeriod(period with { StartUtc = Start.ToOffset(TimeSpan.FromHours(2)) }, Policy));
    }

    [Fact]
    public void Request_RejectsOutOfBoundsNonFiniteAndUnknownTerrain()
    {
        Assert.Equal(422, Assert.Throws<NavigationException>(() => RequestValidation.Validate(
            Request with { Location = new Coordinates(-79, 0) }, Policy)).StatusCode);
        Assert.Equal(400, Assert.Throws<NavigationException>(() => RequestValidation.Validate(
            Request with { Location = new Coordinates(double.NaN, 0) }, Policy)).StatusCode);
        Assert.Throws<NavigationException>(() => RequestValidation.Validate(Request with { Options = new AnalysisOptions("other") }, Policy));
    }
}
