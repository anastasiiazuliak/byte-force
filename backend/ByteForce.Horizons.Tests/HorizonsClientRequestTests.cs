using System.Globalization;
using System.Net;
using ByteForce.Horizons.Tests.TestSupport;
using Xunit;
using static ByteForce.Horizons.Tests.TestSupport.HorizonsTestData;

namespace ByteForce.Horizons.Tests;

public sealed class HorizonsClientRequestTests
{
    [Fact]
    public async Task GetObservationAsync_SendsLunarCoordinatesAndUtcTime_RegardlessOfCulture()
    {
        var previous = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("uk-UA");
        try
        {
            using var handler = new StubHttpMessageHandler((request, index, _) =>
            {
                var parameters = request.RequestUri!.Query.TrimStart('?').Split('&')
                    .Select(part => part.Split('=', 2))
                    .ToDictionary(part => part[0], part => Uri.UnescapeDataString(part[1]).Trim('\''));
                Assert.Equal("coord@301", parameters["CENTER"]);
                Assert.Equal("GEODETIC", parameters["COORD_TYPE"]);
                Assert.Equal("0,-89.5,0.08", parameters["SITE_COORD"]);
                Assert.Equal("2026-11-13 00:00:00.123", parameters["TLIST"]);
                Assert.Equal(index == 0 ? "10" : "399", parameters["COMMAND"]);
                Assert.Equal("AIRLESS", parameters["APPARENT"]);
                Assert.Equal("4", parameters["QUANTITIES"]);
                Assert.Equal("-90", parameters["ELEV_CUT"]);
                Assert.False(parameters.ContainsKey("START_TIME"));
                return Task.FromResult(JsonResponse(Payload(index == 0
                    ? "138.816716908,1.179422905" : "359.9,-4.5")));
            });
            using var http = new HttpClient(handler);

            var result = await new HorizonsClient(http).GetObservationAsync(
                Observer, Time.ToOffset(TimeSpan.FromHours(2)));

            Assert.Equal(Time, result.Time);
            Assert.Equal(TimeSpan.Zero, result.Time.Offset);
            Assert.Equal(1.179422905, result.SunElevationDegrees);
            Assert.Equal(138.816716908, result.SunAzimuthDegrees);
            Assert.Equal(-4.5, result.EarthElevationDegrees);
            Assert.Equal(359.9, result.EarthAzimuthDegrees);
            Assert.Equal(2, handler.Calls);
        }
        finally { CultureInfo.CurrentCulture = previous; }
    }

    [Fact]
    public async Task GetObservationAsync_PreservesHttpFailures()
    {
        using var handler = new StubHttpMessageHandler((_, _, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)));
        using var http = new HttpClient(handler);

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            new HorizonsClient(http).GetObservationAsync(Observer, Time));
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task GetObservationAsync_CancelsActiveHttpRequest()
    {
        using var cancellation = new CancellationTokenSource();
        using var handler = new StubHttpMessageHandler(async (_, _, token) =>
        {
            cancellation.Cancel();
            await Task.Delay(Timeout.Infinite, token);
            throw new InvalidOperationException("Cancellation ignored.");
        });
        using var http = new HttpClient(handler);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new HorizonsClient(http).GetObservationAsync(Observer, Time, cancellation.Token));
    }

    [Fact]
    public async Task GetObservationAsync_RejectsSubMillisecondTimeBeforeHttp()
    {
        using var handler = new StubHttpMessageHandler((_, _, _) =>
            throw new InvalidOperationException("Unexpected HTTP request."));
        using var http = new HttpClient(handler);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            new HorizonsClient(http).GetObservationAsync(Observer, Time.AddTicks(1)));
        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task GetObservationAsync_RejectsTimeBefore1962BeforeHttp()
    {
        using var handler = new StubHttpMessageHandler((_, _, _) =>
            throw new InvalidOperationException("Unexpected HTTP request."));
        using var http = new HttpClient(handler);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            new HorizonsClient(http).GetObservationAsync(Observer, Time.AddYears(-100)));
        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task GetObservationAsync_SerializesRequestsAcrossClientInstances()
    {
        var active = 0;
        using var handler = new StubHttpMessageHandler(async (_, _, token) =>
        {
            Assert.Equal(1, Interlocked.Increment(ref active));
            try
            {
                await Task.Delay(10, token);
                return JsonResponse(Payload("12,8"));
            }
            finally { Interlocked.Decrement(ref active); }
        });
        using var http = new HttpClient(handler);

        await Task.WhenAll(
            new HorizonsClient(http).GetObservationAsync(Observer, Time),
            new HorizonsClient(http).GetObservationAsync(Observer, Time));

        Assert.Equal(4, handler.Calls);
    }
}
