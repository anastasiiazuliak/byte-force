using System.Net;
using LunarNavigator.Api.Infrastructure.Horizons;
using LunarNavigator.Api.Tests.TestSupport;
using LunarNavigator.Core.Analysis;
using Microsoft.Extensions.Options;
using Xunit;
using static LunarNavigator.Api.Tests.TestSupport.ScientificTestData;

namespace LunarNavigator.Api.Tests.Ephemeris;

public sealed class HorizonsEphemerisServiceTests
{
    private static HorizonsEphemerisService Service(StubHorizonsHttpFactory factory) => new(factory,
        Options.Create(new EphemerisSettings { RetryDelayMilliseconds = 1 }), Policy);

    [Fact]
    public async Task Series_CachesByLocationAltitudeAndTime_AndNormalizesNorth()
    {
        using var http = new StubHorizonsHttpFactory();
        using var service = Service(http);
        var period = Request.Period with { EndUtc = Start.AddHours(1) };
        var result = await service.GetAsync(Request.Location, 0.08, period);
        await service.GetAsync(Request.Location, 0.08, period);
        Assert.Equal(4, http.Calls);
        Assert.Equal(2, result.Count);
        Assert.All(result, value => Assert.Equal(0, value.SunAzimuthDegrees));
        await service.GetAsync(Request.Location, 0.09, period);
        Assert.Equal(8, http.Calls);
    }

    [Fact]
    public async Task Series_ConcurrentIdenticalRequestsShareSuccessfulCacheEntries()
    {
        using var http = new StubHorizonsHttpFactory();
        using var service = Service(http);
        await Task.WhenAll(service.GetAsync(Request.Location, 0, Request.Period), service.GetAsync(Request.Location, 0, Request.Period));
        Assert.Equal(6, http.Calls);
    }

    [Fact]
    public async Task Series_RetriesTransientHttpFailureButNotMalformedJson()
    {
        using var retry = new StubHorizonsHttpFactory
        {
            Respond = (request, call, _) => Task.FromResult(call == 1
                ? new HttpResponseMessage(HttpStatusCode.ServiceUnavailable) : StubHorizonsHttpFactory.Payload(request))
        };
        using var service = Service(retry);
        await service.GetAsync(Request.Location, 0, Request.Period with { EndUtc = Start.AddHours(1) });
        Assert.Equal(5, retry.Calls);
        using var malformed = new StubHorizonsHttpFactory
        {
            Respond = (_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<html>bad</html>") })
        };
        using var failed = Service(malformed);
        var error = await Assert.ThrowsAsync<NavigationException>(() => failed.GetAsync(Request.Location, 0, Request.Period));
        Assert.Equal("EPHEMERIS_UNAVAILABLE", error.Code);
        Assert.Equal(1, malformed.Calls);
    }

    [Fact]
    public async Task Series_BoundsRetries_AndPreservesCallerCancellation()
    {
        using var unavailable = new StubHorizonsHttpFactory
        {
            Respond = (_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable))
        };
        using var service = Service(unavailable);
        await Assert.ThrowsAsync<NavigationException>(() => service.GetAsync(Request.Location, 0, Request.Period));
        Assert.Equal(2, unavailable.Calls);
        using var cancellation = new CancellationTokenSource();
        using var cancelled = new StubHorizonsHttpFactory
        {
            Respond = async (_, _, token) =>
            {
                cancellation.Cancel();
                await Task.Delay(Timeout.Infinite, token);
                throw new InvalidOperationException("Cancellation was ignored.");
            }
        };
        using var active = Service(cancelled);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => active.GetAsync(Request.Location, 0, Request.Period, cancellation.Token));
    }
}
