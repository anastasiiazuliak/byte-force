using System.Globalization;
using System.Text.Json;

namespace ByteForce.Horizons;

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
        ArgumentNullException.ThrowIfNull(observer);
        if (time.Ticks % TimeSpan.TicksPerMillisecond != 0)
            throw new ArgumentException("Horizons output supports millisecond time precision.", nameof(time));

        var utc = time.ToUniversalTime();
        // Horizons UT corresponds to UTC from 1962 onward; earlier UT1 needs a separate model.
        if (utc.Year < 1962)
            throw new ArgumentOutOfRangeException(nameof(time), "UTC observations must be in 1962 or later.");

        var sun = await GetPositionAsync("10", observer, utc, cancellationToken).ConfigureAwait(false);
        var earth = await GetPositionAsync("399", observer, utc, cancellationToken).ConfigureAwait(false);
        return new LunarObservation(utc, sun.Elevation, sun.Azimuth, earth.Elevation, earth.Azimuth);
    }

    private async Task<Position> GetPositionAsync(
        string target, LunarObserver observer, DateTimeOffset utc, CancellationToken cancellationToken)
    {
        var parameters = new Dictionary<string, string>
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
            ["TLIST"] = utc.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture),
            ["TLIST_TYPE"] = "CAL",
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
        var query = "format=json&" + string.Join("&", parameters.Select(p =>
            p.Key + "=" + Uri.EscapeDataString("'" + p.Value + "'")));

        await RequestGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            using var response = await _httpClient.GetAsync(Endpoint + "?" + query, cancellationToken)
                .ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            return ParseResponse(json, utc);
        }
        finally
        {
            RequestGate.Release();
        }
    }

    private static Position ParseResponse(string json, DateTimeOffset expectedTime)
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
            if (rows.Length != 1)
                throw new HorizonsException("Expected exactly one Horizons observation.");
            var columns = rows[0].Split(',').Select(column => column.Trim()).ToArray();
            if (columns.Length != labels.Length)
                throw new HorizonsException("Malformed Horizons observation row.");
            if (!DateTimeOffset.TryParseExact(columns[0],
                    ["yyyy-MMM-dd HH:mm:ss.FFFFFFF", "yyyy-MMM-dd HH:mm:ss"],
                    CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out var actualTime) || actualTime != expectedTime)
                throw new HorizonsException("Horizons returned a different observation time.");

            return new Position(ParseAngle(columns[3], 0, 360), ParseAngle(columns[4], -90, 90));
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
