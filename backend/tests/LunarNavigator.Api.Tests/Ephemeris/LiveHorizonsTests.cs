using LunarNavigator.Api.Infrastructure.Horizons;
using Microsoft.Extensions.Options;
using Xunit;
using static LunarNavigator.Api.Tests.TestSupport.ScientificTestData;

namespace LunarNavigator.Api.Tests.Ephemeris;

public sealed class LiveHorizonsTests
{
    [LiveHorizonsFact]
    public async Task Horizons_TwoActualUtcMoments_AreFiniteAndSynchronized()
    {
        using var factory = new LiveHttpFactory();
        using var service = new HorizonsEphemerisService(factory, Options.Create(new EphemerisSettings()), Policy);
        var period = Request.Period with { EndUtc = Start.AddHours(1) };
        var values = await service.GetAsync(Request.Location, 0, period);
        Assert.Equal(2, values.Count);
        foreach (var value in values)
        {
            Assert.InRange(value.SunAzimuthDegrees, 0, Math.BitDecrement(360.0));
            Assert.InRange(value.EarthAzimuthDegrees, 0, Math.BitDecrement(360.0));
            Assert.InRange(value.SunElevationDegrees, -90, 90);
            Assert.InRange(value.EarthElevationDegrees, -90, 90);
            Assert.Equal(TimeSpan.Zero, value.Time.Offset);
            Console.WriteLine($"LIVE NASA {value.Time:O}: Sun {value.SunAzimuthDegrees:R}/{value.SunElevationDegrees:R}, Earth {value.EarthAzimuthDegrees:R}/{value.EarthElevationDegrees:R}");
        }
        Assert.Equal(period.StartUtc, values[0].Time);
        Assert.Equal(period.EndUtc, values[1].Time);
    }

    private sealed class LiveHttpFactory : IHttpClientFactory, IDisposable
    {
        private readonly SocketsHttpHandler _handler = new();
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false) { Timeout = TimeSpan.FromSeconds(30) };
        public void Dispose() => _handler.Dispose();
    }
}
