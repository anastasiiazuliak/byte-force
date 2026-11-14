using LunarNavigator.Core.Ephemeris;
using LunarNavigator.Models;

namespace LunarNavigator.Core.Analysis;

/// <summary>Combines real ephemerides with verified terrain; unavailable terrain always gives unknown visibility.</summary>
public sealed class AnalysisService(
    IEphemerisService ephemeris, ITerrainHeightProvider heights, IHorizonProfileProvider horizons,
    IObserverAltitudeResolver altitudeResolver, AnalysisPolicy policy) : IAnalysisService, IDisposable
{
    private readonly IEphemerisService _ephemeris = ephemeris;
    private readonly ITerrainHeightProvider _heights = heights;
    private readonly IHorizonProfileProvider _horizons = horizons;
    private readonly IObserverAltitudeResolver _altitudeResolver = altitudeResolver;
    private readonly AnalysisPolicy _policy = policy;
    private readonly Dictionary<ProfileKey, (DateTimeOffset Expires, HorizonProfileResult Profile)> _profiles = [];
    private readonly SemaphoreSlim _profileGate = new(1, 1);

    public async Task<AnalysisResponse> AnalyzeAsync(AnalysisRequest request, CancellationToken cancellationToken = default)
    {
        RequestValidation.Validate(request, _policy);
        var options = request.Options ?? new AnalysisOptions();
        var warnings = new List<string>();
        var location = new TerrainLocation(request.Location.Latitude, request.Location.Longitude);
        TerrainHeightResult height;
        try { height = await _heights.GetHeightAsync(location, cancellationToken); }
        catch (Exception exception) when (exception is IOException or TimeoutException)
        {
            height = new TerrainHeightResult(null, null, null, null, false, ["Terrain height provider is unavailable."]);
        }
        warnings.AddRange(height.Warnings);
        var altitude = _altitudeResolver.Resolve(height);
        if (altitude.Warning is not null) warnings.Add(altitude.Warning);
        HorizonProfileResult? profile = null;
        if (altitude.TerrainDatumVerified && request.Location.Latitude != -90)
        {
            try { profile = await GetProfileAsync(location, height, cancellationToken); }
            catch (Exception exception) when (exception is IOException or TimeoutException)
            {
                warnings.Add("Terrain horizon provider is unavailable.");
            }
        }
        if (request.Location.Latitude == -90)
            warnings.Add("Azimuth is singular at the exact pole; terrain visibility requires a reviewed meridian convention.");
        if (profile is not null) warnings.AddRange(profile.Warnings);
        var points = profile?.Points?.OrderBy(point => point.AzimuthDeg).ToArray() ?? [];
        var terrainApplied = altitude.TerrainDatumVerified && ValidProfile(profile, height, points);
        if (!terrainApplied)
            warnings.Add("Terrain visibility is indeterminate; visible, clearance and summary metrics are unknown.");
        var observations = await _ephemeris.GetAsync(request.Location, altitude.Kilometers, request.Period, cancellationToken);
        ValidateObservations(observations, RequestValidation.SampleTimes(request.Period));
        var samples = observations.Select(value => new AnalysisSample(value.Time,
            Position(value.SunAzimuthDegrees, value.SunElevationDegrees),
            Position(value.EarthAzimuthDegrees, value.EarthElevationDegrees))).ToArray();
        if (terrainApplied && samples.Any(sample => Math.Abs(sample.Sun.ClearanceDeg!.Value) < 0.001 || Math.Abs(sample.Earth.ClearanceDeg!.Value) < 0.001))
            warnings.Add("Near-horizon visibility is sensitive to terrain resolution and sampling error.");
        IReadOnlyList<VisibilityInterval> sun = terrainApplied ? VisibilityCalculator.GetIntervals(samples, sample => sample.Sun) : [];
        IReadOnlyList<VisibilityInterval> earth = terrainApplied ? VisibilityCalculator.GetIntervals(samples, sample => sample.Earth) : [];
        var durationHours = (request.Period.EndUtc - request.Period.StartUtc).TotalHours;
        var summary = terrainApplied
            ? new AnalysisSummary(VisibilityCalculator.Hours(sun), VisibilityCalculator.Hours(earth),
                VisibilityCalculator.BothHours(sun, earth),
                Math.Clamp(100 * VisibilityCalculator.Hours(sun) / durationHours, 0, 100),
                Math.Clamp(100 * VisibilityCalculator.Hours(earth) / durationHours, 0, 100))
            : new AnalysisSummary(null, null, null, null, null);
        warnings.Add("Center-of-disk airless apparent positions; intervals use linear clearance interpolation at the requested sampling resolution, not an exact event solver.");
        return new AnalysisResponse(terrainApplied ? "complete" : "partial",
            new AnalysisLocation(location.Latitude, location.Longitude,
                height.ElevationM is { } elevation && double.IsFinite(elevation) ? elevation : null),
            request.Period, summary, samples, new AnalysisIntervals(sun, earth),
            terrainApplied && options.IncludeHorizon ? new HorizonResponse(points) : null,
            new AnalysisQuality("JPL Horizons", height.TerrainSource, terrainApplied,
                height.ResolutionMeters is > 0 && double.IsFinite(height.ResolutionMeters.Value) ? height.ResolutionMeters : null,
                "center-of-disk airless apparent; cyclic terrain interpolation; linear clearance crossings",
                warnings.Distinct(StringComparer.Ordinal).ToArray()));

        BodyPosition Position(double azimuth, double elevation)
        {
            if (!terrainApplied) return new BodyPosition(azimuth, elevation, null, null, null);
            var horizon = VisibilityCalculator.InterpolateHorizon(points, azimuth);
            var clearance = elevation - horizon;
            return new BodyPosition(azimuth, elevation, horizon, clearance, clearance > 0);
        }
    }

    private async Task<HorizonProfileResult> GetProfileAsync(TerrainLocation location, TerrainHeightResult height, CancellationToken token)
    {
        var key = new ProfileKey(location, height.ElevationM, height.TerrainSource, height.VerticalReference, height.ResolutionMeters);
        await _profileGate.WaitAsync(token);
        try
        {
            if (_profiles.TryGetValue(key, out var cached) && cached.Expires > DateTimeOffset.UtcNow) return cached.Profile;
            var profile = await _horizons.GetProfileAsync(location, token);
            if (_profiles.Count >= 128) _profiles.Clear();
            // There is no revision token in the frozen provider interface. Cache only profiles for 60s, never whole analyses.
            if (profile.TerrainApplied) _profiles[key] = (DateTimeOffset.UtcNow.AddSeconds(60), profile);
            return profile;
        }
        finally { _profileGate.Release(); }
    }

    private static bool ValidProfile(HorizonProfileResult? profile, TerrainHeightResult height, IReadOnlyList<HorizonPoint> points)
    {
        if (profile?.TerrainApplied != true || profile.TerrainSource != height.TerrainSource || string.IsNullOrWhiteSpace(profile.TerrainSource) ||
            profile.ResolutionMeters is not > 0 || !double.IsFinite(profile.ResolutionMeters.Value) ||
            height.ResolutionMeters is not > 0 || !double.IsFinite(height.ResolutionMeters.Value) ||
            Math.Abs(profile.ResolutionMeters.Value - height.ResolutionMeters.Value) > 0.001 || points.Count < 72)
            return false;
        for (var index = 0; index < points.Count; index++)
        {
            var point = points[index];
            var next = points[(index + 1) % points.Count].AzimuthDeg + (index == points.Count - 1 ? 360 : 0);
            if (!double.IsFinite(point.AzimuthDeg) || point.AzimuthDeg is < 0 or >= 360 ||
                !double.IsFinite(point.ElevationDeg) || point.ElevationDeg is < -90 or > 90 ||
                next - point.AzimuthDeg is <= 0 or > 5)
                return false;
        }
        return true;
    }

    private static void ValidateObservations(IReadOnlyList<LunarObservation> values, IReadOnlyList<DateTimeOffset> times)
    {
        if (values.Count != times.Count) throw InvalidEphemeris();
        for (var index = 0; index < values.Count; index++)
        {
            var value = values[index];
            if (value.Time != times[index] || value.Time.Offset != TimeSpan.Zero ||
                !ValidAngle(value.SunAzimuthDegrees, value.SunElevationDegrees) || !ValidAngle(value.EarthAzimuthDegrees, value.EarthElevationDegrees))
                throw InvalidEphemeris();
        }
    }

    private static bool ValidAngle(double azimuth, double elevation) => double.IsFinite(azimuth) &&
        azimuth is >= 0 and < 360 && double.IsFinite(elevation) && elevation is >= -90 and <= 90;

    private static NavigationException InvalidEphemeris() => new(503, "EPHEMERIS_UNAVAILABLE", "Ephemeris samples are incomplete or invalid.");

    public void Dispose() => _profileGate.Dispose();

    private sealed record ProfileKey(TerrainLocation Location, double? Elevation, string? Source, string? Datum, double? Resolution);
}
