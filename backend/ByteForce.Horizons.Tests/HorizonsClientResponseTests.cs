using ByteForce.Horizons.Tests.TestSupport;
using Xunit;
using static ByteForce.Horizons.Tests.TestSupport.HorizonsTestData;

namespace ByteForce.Horizons.Tests;

public sealed class HorizonsClientResponseTests
{
    public static TheoryData<string, string> InvalidResponses => new()
    {
        { "API error with HTTP 200", "{\"error\":\"No ephemeris available\"}" },
        { "Malformed JSON", "<html>unavailable</html>" },
        { "Missing result", "{\"signature\":{\"version\":\"1.2\"}}" },
        { "Unknown API version", Payload("12,8", version: "2.0") },
        { "Unavailable angle", Payload("n.a.,8") },
        { "Nonfinite angle", Payload("12,NaN") },
        { "Out of range angle", Payload("12,91") },
        { "Wrong time", Payload("12,8", time: "2026-Nov-13 00:00:01.123") },
        { "Changed columns", Payload("12,8").Replace("Azimuth_(a-app)", "Azimuth_(r-app)") },
        { "Missing table", Payload("12,8").Replace("$$EOE", "missing") },
        { "Duplicate rows", Payload("12,8", duplicate: true) }
    };

    [Theory]
    [MemberData(nameof(InvalidResponses))]
    public async Task GetObservationAsync_RejectsInvalidResponse(string scenario, string payload)
    {
        Assert.NotEmpty(scenario);
        using var handler = new StubHttpMessageHandler((_, _, _) => Task.FromResult(JsonResponse(payload)));
        using var http = new HttpClient(handler);

        await Assert.ThrowsAsync<HorizonsException>(() =>
            new HorizonsClient(http).GetObservationAsync(Observer, Time));
        Assert.Equal(1, handler.Calls);
    }

    [Theory]
    [InlineData("1.2")]
    [InlineData("1.3")]
    public async Task GetObservationAsync_AcceptsSupportedApiVersions(string version)
    {
        using var handler = new StubHttpMessageHandler((_, _, _) =>
            Task.FromResult(JsonResponse(Payload("12,8", version: version))));
        using var http = new HttpClient(handler);

        var result = await new HorizonsClient(http).GetObservationAsync(Observer, Time);

        Assert.Equal(8d, result.EarthElevationDegrees);
    }
}
