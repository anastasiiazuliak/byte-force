using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Ephemeris;

public sealed class MoonFixedEphemerisService(IMoonFixedProvider provider, AnalysisPolicy policy) : IMoonFixedEphemerisService
{
    private readonly IMoonFixedProvider _provider = provider;
    private readonly AnalysisPolicy _policy = policy;

    public async Task<EphemerisResponse> GetAsync(EphemerisRequest request, CancellationToken cancellationToken = default)
    {
        if (request is null) throw RequestValidation.Invalid("An ephemeris period is required.");
        var period = request.ToPeriod();
        RequestValidation.ValidatePeriod(period, _policy);
        cancellationToken.ThrowIfCancellationRequested();
        if (!_provider.IsVerified) throw Unavailable();
        var result = await _provider.GetAsync(period, cancellationToken);
        if (result is null || !result.FrameVerified || result.ReferenceFrame != "MOON_ME" || string.IsNullOrWhiteSpace(result.VectorConvention) ||
            result.Quality is null || string.IsNullOrWhiteSpace(result.Quality.Source) || result.Samples is null)
            throw Unavailable();
        var times = RequestValidation.SampleTimes(period);
        if (times.Count != result.Samples.Count) throw Unavailable();
        var samples = new List<EphemerisSample>();
        for (var index = 0; index < times.Count; index++)
        {
            var value = result.Samples[index];
            if (value is null || value.TimeUtc != times[index] || value.TimeUtc.Offset != TimeSpan.Zero) throw Unavailable();
            samples.Add(new EphemerisSample(value.TimeUtc, Normalize(value.SunDirection), Normalize(value.EarthDirection)));
        }
        return new EphemerisResponse(result.ReferenceFrame, result.VectorConvention, samples, result.Quality);
    }

    private static IReadOnlyList<double> Normalize(IReadOnlyList<double> value)
    {
        if (value is not { Count: 3 } || value.Any(component => !double.IsFinite(component))) throw Unavailable();
        var scale = value.Max(component => Math.Abs(component));
        if (scale <= 0) throw Unavailable();
        var scaled = value.Select(component => component / scale).ToArray();
        var length = Math.Sqrt(scaled.Sum(component => component * component));
        return scaled.Select(component => component / length).ToArray();
    }

    private static NavigationException Unavailable() => new(503, "EPHEMERIS_UNAVAILABLE", "Verified, synchronized Moon-fixed ephemerides are unavailable.");
}
