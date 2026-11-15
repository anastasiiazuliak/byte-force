using System.Globalization;
using System.Text.Json;
using LunarNavigator.Models;

namespace LunarNavigator.Horizons;

/// <summary>
/// Queries NASA JPL Horizons. The caller owns and reuses the supplied HttpClient.
/// HTTP failures and cancellation retain their standard .NET exception types.
/// </summary>
public sealed class HorizonsClient(HttpClient httpClient) : IHorizonsClient
{
    private const string Endpoint = "https://ssd.jpl.nasa.gov/api/horizons.api";
    private readonly HttpClient _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));

    // JPL asks API consumers to submit only one request at a time.
    private static readonly SemaphoreSlim RequestGate = new(1, 1);

    public async Task<LunarObservation> GetObservationAsync(
        LunarObserver observer, DateTimeOffset time, CancellationToken cancellationToken = default)
    {
        var utc = ValidateAndNormalizeTime(observer, time, nameof(time));
        IReadOnlyList<DateTimeOffset> expected = [utc];
        var sun = (await GetPositionsByTlistAsync("10", observer, expected, cancellationToken).ConfigureAwait(false))[0];
        var earth = (await GetPositionsByTlistAsync("399", observer, expected, cancellationToken).ConfigureAwait(false))[0];
        return new LunarObservation(utc, sun.Elevation, sun.Azimuth, earth.Elevation, earth.Azimuth);
    }

    /// <summary>Gets Sun and Earth positions across a uniform step interval in two batched Horizons requests.</summary>
    public async Task<IReadOnlyList<LunarObservation>> GetObservationSeriesAsync(
        LunarObserver observer, DateTimeOffset startTime, DateTimeOffset endTime, int stepMinutes,
        CancellationToken cancellationToken = default)
    {
        var startUtc = ValidateAndNormalizeTime(observer, startTime, nameof(startTime));
        var endUtc = ValidateAndNormalizeTime(observer, endTime, nameof(endTime));
        if (stepMinutes <= 0)
            throw new ArgumentOutOfRangeException(nameof(stepMinutes), "Step minutes must be positive.");
        if (endUtc < startUtc)
            throw new ArgumentOutOfRangeException(nameof(endTime), "End time must not precede start time.");

        var step = TimeSpan.FromMinutes(stepMinutes);
        var spanTicks = endUtc.UtcTicks - startUtc.UtcTicks;
        if (spanTicks % step.Ticks != 0)
            throw new ArgumentException("Series span must be an exact multiple of stepMinutes.", nameof(endTime));

        var count = checked((int)(spanTicks / step.Ticks) + 1);
        if (count == 1)
            return [await GetObservationAsync(observer, startUtc, cancellationToken).ConfigureAwait(false)];

        var expectedTimes = new DateTimeOffset[count];
        for (var i = 0; i < count; i++)
            expectedTimes[i] = startUtc.AddTicks(step.Ticks * i);

        var sun = await GetPositionsByRangeAsync("10", observer, startUtc, endUtc, stepMinutes, expectedTimes, cancellationToken)
            .ConfigureAwait(false);
        var earth = await GetPositionsByRangeAsync("399", observer, startUtc, endUtc, stepMinutes, expectedTimes, cancellationToken)
            .ConfigureAwait(false);

        return CombineObservations(expectedTimes, sun, earth);
    }

    /// <summary>Gets Sun and Earth positions for an arbitrary list of timestamps using batched TLIST queries.</summary>
    public async Task<IReadOnlyList<LunarObservation>> GetObservationsAsync(
        LunarObserver observer, IReadOnlyList<DateTimeOffset> times, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(observer);
        ArgumentNullException.ThrowIfNull(times);
        if (times.Count == 0)
            return [];
        if (times.Count == 1)
            return [await GetObservationAsync(observer, times[0], cancellationToken).ConfigureAwait(false)];

        var expectedTimes = new DateTimeOffset[times.Count];
        for (var i = 0; i < times.Count; i++)
            expectedTimes[i] = ValidateAndNormalizeTime(observer, times[i], nameof(times));

        var sun = await GetPositionsByTlistAsync("10", observer, expectedTimes, cancellationToken).ConfigureAwait(false);
        var earth = await GetPositionsByTlistAsync("399", observer, expectedTimes, cancellationToken).ConfigureAwait(false);

        return CombineObservations(expectedTimes, sun, earth);
    }

    private static DateTimeOffset ValidateAndNormalizeTime(LunarObserver observer, DateTimeOffset time, string paramName)
    {
        ArgumentNullException.ThrowIfNull(observer);
        if (time.Ticks % TimeSpan.TicksPerMillisecond != 0)
            throw new ArgumentException("Horizons output supports millisecond time precision.", paramName);

        var utc = time.ToUniversalTime();
        // Horizons UT corresponds to UTC from 1962 onward; earlier UT1 needs a separate model.
        if (utc.Year < 1962)
            throw new ArgumentOutOfRangeException(paramName, "UTC observations must be in 1962 or later.");

        return utc;
    }

    private static LunarObservation[] CombineObservations(
        DateTimeOffset[] times, Position[] sun, Position[] earth)
    {
        var observations = new LunarObservation[times.Length];
        for (var i = 0; i < times.Length; i++)
            observations[i] = new LunarObservation(times[i], sun[i].Elevation, sun[i].Azimuth, earth[i].Elevation, earth[i].Azimuth);
        return observations;
    }

    private static Dictionary<string, string> BuildBaseParameters(string target, LunarObserver observer) => new()
    {
        ["COMMAND"] = target,
        ["OBJ_DATA"] = "NO",
        ["MAKE_EPHEM"] = "YES",
        ["EPHEM_TYPE"] = "OBSERVER",
        ["CENTER"] = "coord@301",
        ["COORD_TYPE"] = "GEODETIC",
        // Horizons requires longitude, latitude, altitude (km), in that order.
        ["SITE_COORD"] = FormattableString.Invariant(
            $"{observer.LongitudeDegreesEast:R},{observer.LatitudeDegrees:R},{observer.AltitudeKilometers:R}"),
        ["TIME_TYPE"] = "UT",
        ["TIME_ZONE"] = "+00:00",
        ["TIME_DIGITS"] = "FRACSEC",
        ["CAL_FORMAT"] = "CAL",
        ["CAL_TYPE"] = "GREGORIAN",
        ["QUANTITIES"] = "4",
        ["APPARENT"] = "AIRLESS",
        ["CSV_FORMAT"] = "YES",
        ["EXTRA_PREC"] = "YES",
        ["ELEV_CUT"] = "-90",
        ["SKIP_DAYLT"] = "NO"
    };

    private static string FormatHorizonsTime(DateTimeOffset utc) =>
        utc.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture);

    private Task<Position[]> GetPositionsByTlistAsync(
        string target, LunarObserver observer, IReadOnlyList<DateTimeOffset> expectedTimes, CancellationToken cancellationToken)
    {
        var parameters = BuildBaseParameters(target, observer);
        parameters["TLIST_TYPE"] = "CAL";
        var encodedParams = new List<string>(parameters.Count + 2) { "format=json" };
        foreach (var p in parameters)
            encodedParams.Add(p.Key + "=" + Uri.EscapeDataString("'" + p.Value + "'"));

        var tlistLiteral = expectedTimes.Count == 1
            ? "'" + FormatHorizonsTime(expectedTimes[0]) + "'"
            : string.Join(",", expectedTimes.Select(t => "'" + FormatHorizonsTime(t) + "'"));
        encodedParams.Add("TLIST=" + Uri.EscapeDataString(tlistLiteral));

        return SendAndParseAsync(string.Join("&", encodedParams), expectedTimes, cancellationToken);
    }

    private Task<Position[]> GetPositionsByRangeAsync(
        string target, LunarObserver observer, DateTimeOffset startUtc, DateTimeOffset endUtc, int stepMinutes,
        IReadOnlyList<DateTimeOffset> expectedTimes, CancellationToken cancellationToken)
    {
        var parameters = BuildBaseParameters(target, observer);
        parameters["START_TIME"] = FormatHorizonsTime(startUtc);
        parameters["STOP_TIME"] = FormatHorizonsTime(endUtc);
        parameters["STEP_SIZE"] = FormattableString.Invariant($"{stepMinutes}m");

        var query = "format=json&" + string.Join("&", parameters.Select(p =>
            p.Key + "=" + Uri.EscapeDataString("'" + p.Value + "'")));
        return SendAndParseAsync(query, expectedTimes, cancellationToken);
    }

    private async Task<Position[]> SendAndParseAsync(
        string query, IReadOnlyList<DateTimeOffset> expectedTimes, CancellationToken cancellationToken)
    {
        await RequestGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            using var response = await _httpClient.GetAsync(Endpoint + "?" + query, cancellationToken)
                .ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            return ParseResponse(json, expectedTimes);
        }
        finally
        {
            RequestGate.Release();
        }
    }

    private static Position[] ParseResponse(string json, IReadOnlyList<DateTimeOffset> expectedTimes)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.TryGetProperty("error", out var error))
                throw new HorizonsException("Horizons: " + error.ToString());

            var version = root.GetProperty("signature").GetProperty("version").GetString();
            // 1.2 verified against the live service; 1.3 documented by NASA.
            if (version is not ("1.2" or "1.3"))
                throw new HorizonsException($"Unsupported Horizons API version: {version}.");

            var result = root.GetProperty("result").GetString()
                ?? throw new HorizonsException("Horizons returned no result.");
            var lines = result.Split('\n').Select(line => line.Trim()).ToArray();
            var start = Array.IndexOf(lines, "$$SOE");
            var end = Array.IndexOf(lines, "$$EOE");
            if (start < 0 || end <= start)
                throw new HorizonsException("Horizons response has no ephemeris table.");

            // Check column labels rather than trusting numeric positions after an API change.
            var header = lines.Take(start).LastOrDefault(line => line.StartsWith("Date__", StringComparison.Ordinal));
            var labels = header?.Split(',').Select(label => label.Trim()).ToArray();
            if (labels is not { Length: 6 } || !labels[0].Contains("(UT)", StringComparison.Ordinal)
                || labels[3] != "Azimuth_(a-app)" || labels[4] != "Elevation_(a-app)")
                throw new HorizonsException("Unexpected Horizons azimuth/elevation columns.");

            var rows = lines[(start + 1)..end].Where(line => !string.IsNullOrWhiteSpace(line)).ToArray();
            if (rows.Length != expectedTimes.Count)
                throw new HorizonsException(
                    expectedTimes.Count == 1
                        ? "Expected exactly one Horizons observation."
                        : $"Expected {expectedTimes.Count} Horizons observations, got {rows.Length}.");

            var positions = new Position[rows.Length];
            for (var i = 0; i < rows.Length; i++)
            {
                var columns = rows[i].Split(',').Select(column => column.Trim()).ToArray();
                if (columns.Length != labels.Length)
                    throw new HorizonsException("Malformed Horizons observation row.");
                if (!DateTimeOffset.TryParseExact(columns[0],
                        ["yyyy-MMM-dd HH:mm:ss.FFFFFFF", "yyyy-MMM-dd HH:mm:ss"],
                        CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                        out var actualTime) || actualTime != expectedTimes[i])
                    throw new HorizonsException("Horizons returned a different observation time.");

                positions[i] = new Position(ParseAngle(columns[3], 0, 360), ParseAngle(columns[4], -90, 90));
            }

            return positions;
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            throw new HorizonsException("Invalid Horizons JSON response.", exception);
        }
    }

    private static double ParseAngle(string value, double minimum, double maximum)
    {
        if (!double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var angle)
            || !double.IsFinite(angle) || angle < minimum || angle > maximum)
            throw new HorizonsException($"Invalid or unavailable Horizons angle: {value}.");
        return angle;
    }

    private sealed record Position(double Azimuth, double Elevation);
}
