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
    private const int MaxSeriesBatchSize = 500;
    private const int MaxTlistBatchSize = 40;

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

        var sampleTimes = RequestValidation.SampleTimes(period).ToArray();
        var result = new LunarObservation[sampleTimes.Length];
        var missingIndices = new List<int>();

        for (var i = 0; i < sampleTimes.Length; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var key = new CacheKey(location.Latitude, location.Longitude, altitudeKilometers, sampleTimes[i].UtcTicks);
            if (_cache.TryGetValue(key, out LunarObservation? cached) && cached is not null)
                result[i] = cached;
            else
                missingIndices.Add(i);
        }

        if (missingIndices.Count == 0)
            return result;

        var observer = new LunarObserver(location.Latitude, location.Longitude, altitudeKilometers);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var stillMissing = new List<int>(missingIndices.Count);
            foreach (var index in missingIndices)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var key = new CacheKey(location.Latitude, location.Longitude, altitudeKilometers, sampleTimes[index].UtcTicks);
                if (_cache.TryGetValue(key, out LunarObservation? cached) && cached is not null)
                    result[index] = cached;
                else
                    stillMissing.Add(index);
            }

            if (stillMissing.Count > 0)
                await FetchMissingAsync(observer, location, altitudeKilometers, period.StepMinutes, sampleTimes, stillMissing, result, cancellationToken);
        }
        finally { _gate.Release(); }

        return result;
    }

    private async Task FetchMissingAsync(
        LunarObserver observer, Coordinates location, double altitudeKilometers, int stepMinutes,
        DateTimeOffset[] sampleTimes, List<int> missingIndices, LunarObservation[] result, CancellationToken token)
    {
        var stepTicks = TimeSpan.FromMinutes(stepMinutes).Ticks;
        var isolatedIndices = new List<int>();
        var cursor = 0;

        while (cursor < missingIndices.Count)
        {
            var runEnd = cursor;
            while (runEnd + 1 < missingIndices.Count
                && runEnd + 1 - cursor < MaxSeriesBatchSize
                && missingIndices[runEnd + 1] == missingIndices[runEnd] + 1
                && sampleTimes[missingIndices[runEnd + 1]].UtcTicks - sampleTimes[missingIndices[runEnd]].UtcTicks == stepTicks)
            {
                runEnd++;
            }

            var runLength = runEnd - cursor + 1;
            if (runLength >= 2)
            {
                var startTime = sampleTimes[missingIndices[cursor]];
                var endTime = sampleTimes[missingIndices[runEnd]];
                var batch = await ExecuteWithRetryAsync(
                    (client, ct) => client.GetObservationSeriesAsync(observer, startTime, endTime, stepMinutes, ct),
                    token);

                for (var offset = 0; offset < batch.Count; offset++)
                    StoreObservation(location, altitudeKilometers, missingIndices[cursor + offset], batch[offset], result);
            }
            else
            {
                isolatedIndices.Add(missingIndices[cursor]);
            }

            cursor = runEnd + 1;
        }

        for (var offset = 0; offset < isolatedIndices.Count; offset += MaxTlistBatchSize)
        {
            var chunkCount = Math.Min(MaxTlistBatchSize, isolatedIndices.Count - offset);
            var chunkTimes = new DateTimeOffset[chunkCount];
            for (var j = 0; j < chunkCount; j++)
                chunkTimes[j] = sampleTimes[isolatedIndices[offset + j]];

            var batch = await ExecuteWithRetryAsync(
                (client, ct) => client.GetObservationsAsync(observer, chunkTimes, ct),
                token);

            for (var j = 0; j < batch.Count; j++)
                StoreObservation(location, altitudeKilometers, isolatedIndices[offset + j], batch[j], result);
        }
    }

    private void StoreObservation(
        Coordinates location, double altitudeKilometers, int index, LunarObservation raw, LunarObservation[] result)
    {
        var normalized = raw with
        {
            SunAzimuthDegrees = NormalizeAzimuth(raw.SunAzimuthDegrees),
            EarthAzimuthDegrees = NormalizeAzimuth(raw.EarthAzimuthDegrees)
        };
        var key = new CacheKey(location.Latitude, location.Longitude, altitudeKilometers, normalized.Time.UtcTicks);
        _cache.Set(key, normalized, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_settings.CacheSeconds),
            Size = 1
        });
        result[index] = normalized;
    }

    private async Task<T> ExecuteWithRetryAsync<T>(
        Func<HorizonsClient, CancellationToken, Task<T>> operation, CancellationToken token)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var http = _clients.CreateClient("Horizons");
                return await operation(new HorizonsClient(http), token);
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
