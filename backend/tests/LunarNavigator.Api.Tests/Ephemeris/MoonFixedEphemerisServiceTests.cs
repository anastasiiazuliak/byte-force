using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Ephemeris;
using Xunit;
using static LunarNavigator.Api.Tests.TestSupport.ScientificTestData;

namespace LunarNavigator.Api.Tests.Ephemeris;

public sealed class MoonFixedEphemerisServiceTests
{
    private static EphemerisRequest RequestBody => new(Start, Start.AddHours(2), 60);

    [Fact]
    public async Task Ephemeris_DefaultProviderRefusesUnverifiedTransformation()
    {
        var service = new MoonFixedEphemerisService(new UnavailableMoonFixedProvider(), Policy);
        Assert.Equal("EPHEMERIS_UNAVAILABLE", (await Assert.ThrowsAsync<NavigationException>(() => service.GetAsync(RequestBody))).Code);
    }

    [Fact]
    public async Task Ephemeris_NormalizesVectorsAndPreservesAxesAndSampleTimes()
    {
        var service = new MoonFixedEphemerisService(new TestProvider(), Policy);
        var result = await service.GetAsync(RequestBody);
        Assert.Equal("MOON_ME", result.ReferenceFrame);
        Assert.Equal(3, result.Samples.Count);
        Assert.Equal(Start.AddHours(2), result.Samples[^1].TimeUtc);
        Assert.All(result.Samples, value =>
        {
            Assert.Equal(new[] { 0.6, 0.8, 0 }, value.SunDirection);
            Assert.Equal(new[] { 0.0, 0, 1 }, value.EarthDirection);
            Assert.Equal(1, value.SunDirection.Sum(component => component * component), 12);
        });
    }

    [Theory]
    [InlineData("ENU", true, false)]
    [InlineData("MOON_ME", false, false)]
    [InlineData("MOON_ME", true, true)]
    public async Task Ephemeris_RejectsWrongFrameUnverifiedDataAndMissingTimes(string frame, bool verified, bool omit)
    {
        var service = new MoonFixedEphemerisService(new TestProvider { Frame = frame, Verified = verified, OmitLast = omit }, Policy);
        await Assert.ThrowsAsync<NavigationException>(() => service.GetAsync(RequestBody));
    }

    [Fact]
    public async Task Ephemeris_RejectsZeroAndNonFiniteVectors()
    {
        foreach (var direction in new[] { new[] { 0.0, 0, 0 }, new[] { double.NaN, 1, 0 }, new[] { 1.0, 0 } })
        {
            var service = new MoonFixedEphemerisService(new TestProvider { Sun = direction }, Policy);
            await Assert.ThrowsAsync<NavigationException>(() => service.GetAsync(RequestBody));
        }
        var huge = await new MoonFixedEphemerisService(new TestProvider { Sun = [1e300, 1e300, 0] }, Policy).GetAsync(RequestBody);
        Assert.Equal(1, huge.Samples[0].SunDirection.Sum(value => value * value), 12);
    }

    private sealed class TestProvider : IMoonFixedProvider
    {
        public bool IsVerified => true;
        public string Frame { get; init; } = "MOON_ME";
        public bool Verified { get; init; } = true;
        public bool OmitLast { get; init; }
        public double[] Sun { get; init; } = [3, 4, 0];
        public Task<MoonFixedProviderResult> GetAsync(AnalysisPeriod period, CancellationToken cancellationToken = default)
        {
            var times = RequestValidation.SampleTimes(period);
            return Task.FromResult(new MoonFixedProviderResult(Verified, Frame, "unit XYZ in synthetic test frame",
                times.Take(times.Count - (OmitLast ? 1 : 0)).Select(time => new EphemerisSample(time, Sun, new[] { 0.0, 0, 5 })).ToArray(),
                new EphemerisQuality("SYNTHETIC TEST ONLY", [])));
        }
    }
}
