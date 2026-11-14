using System.Net;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Ephemeris;
using LunarNavigator.Horizons;
using LunarNavigator.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace LunarNavigator.Api.Infrastructure.Horizons;

/// <summary>Adds bounded caching, retries and series sampling around the existing scientific client.</summary>
public sealed class HorizonsEphemerisService(
    IHttpClientFactory clients, IOptions<EphemerisSettings> settings, AnalysisPolicy policy) : IEphemerisService, IDisposable
{
    private readonly IHttpClientFactory _clients = clients;
    private readonly EphemerisSettings _settings = settings.Value;
    private readonly AnalysisPolicy _policy = policy;
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 10000 });
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task<IReadOnlyList<LunarObservation>> GetAsync(
        Coordinates location, double altitudeKilometers, AnalysisPeriod period, CancellationToken cancellationToken = default)
    {
        RequestValidation.Validate(new AnalysisRequest(location, period), _policy);
        if (!double.IsFinite(altitudeKilometers) || altitudeKilometers <= -1737.4)
            throw RequestValidation.Invalid("Observer altitude is invalid.");
        var observer = new LunarObserver(location.Latitude, location.Longitude, altitudeKilometers);
        var result = new List<LunarObservation>();
        foreach (var time in RequestValidation.SampleTimes(period))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var key = new CacheKey(location.Latitude, location.Longitude, altitudeKilometers, time.UtcTicks);
            if (_cache.TryGetValue(key, out LunarObservation? cached) && cached is not null)
            {
                result.Add(cached);
                continue;
            }
            await _gate.WaitAsync(cancellationToken);
            try
            {
                if (!_cache.TryGetValue(key, out cached) || cached is null)
                {
                    cached = await FetchAsync(observer, time, cancellationToken);
                    _cache.Set(key, cached, new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_settings.CacheSeconds), Size = 1
                    });
                }
                result.Add(cached);
            }
            finally { _gate.Release(); }
        }
        return result;
    }

    private async Task<LunarObservation> FetchAsync(LunarObserver observer, DateTimeOffset time, CancellationToken token)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var http = _clients.CreateClient("Horizons");
                var value = await new HorizonsClient(http).GetObservationAsync(observer, time, token);
                return value with
                {
                    SunAzimuthDegrees = NormalizeAzimuth(value.SunAzimuthDegrees),
                    EarthAzimuthDegrees = NormalizeAzimuth(value.EarthAzimuthDegrees)
                };
            }
            catch (Exception exception) when (exception is HttpRequestException or HorizonsException or OperationCanceledException)
            {
                token.ThrowIfCancellationRequested();
                var transient = exception is OperationCanceledException || exception is HttpRequestException http &&
                    (http.StatusCode is null or HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests || (int)http.StatusCode >= 500);
                if (!transient || attempt >= _settings.MaxAttempts)
                    throw new NavigationException(503, "EPHEMERIS_UNAVAILABLE", "JPL Horizons ephemerides are unavailable.");
                await Task.Delay(TimeSpan.FromMilliseconds(_settings.RetryDelayMilliseconds * attempt), token);
            }
        }
    }

    private static double NormalizeAzimuth(double degrees) => (degrees % 360 + 360) % 360;

    public void Dispose()
    {
        _cache.Dispose();
        _gate.Dispose();
    }

    private sealed record CacheKey(double Latitude, double Longitude, double AltitudeKm, long UtcTicks);
}
