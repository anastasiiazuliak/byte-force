using System.Collections.Concurrent;
using LunarNavigator.Core.Ephemeris;
using LunarNavigator.Models;

namespace LunarNavigator.Core.Analysis;

/// <summary>Combines real ephemerides with verified terrain; unavailable terrain always gives unknown visibility.</summary>
public sealed class AnalysisService(
    IEphemerisService ephemeris, ITerrainHeightProvider heights, IHorizonProfileProvider horizons,
    IObserverAltitudeResolver altitudeResolver, AnalysisPolicy policy) : IAnalysisService, IDisposable
{
    private const int ProfileGateStripes = 32;

    private readonly IEphemerisService _ephemeris = ephemeris;
    private readonly ITerrainHeightProvider _heights = heights;
    private readonly IHorizonProfileProvider _horizons = horizons;
    private readonly IObserverAltitudeResolver _altitudeResolver = altitudeResolver;
    private readonly AnalysisPolicy _policy = policy;
    private readonly ConcurrentDictionary<ProfileKey, (DateTimeOffset Expires, HorizonProfileResult Profile, HorizonPoint[] SortedPoints)> _profiles = [];
    private readonly SemaphoreSlim[] _profileGates = Enumerable.Range(0, ProfileGateStripes).Select(_ => new SemaphoreSlim(1, 1)).ToArray();

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
        // Horizons' DE421 mean-Earth orientation is not valid for arbitrary future UTC epochs.
        if (height.DatumAlignmentVerified && (request.Period.StartUtc.Year < 1962 || request.Period.EndUtc.Year >= 2650))
        {
            height = height with { DatumAlignmentVerified = false };
            warnings.Add("Reviewed lunar datum applicability is restricted to 1962-01-01 <= UTC < 2650-01-01; terrain alignment is unknown for this period.");
        }
        var altitude = _altitudeResolver.Resolve(height);
        if (altitude.Warning is not null) warnings.Add(altitude.Warning);
        var profileTask = altitude.TerrainDatumVerified && request.Location.Latitude != -90
            ? TryGetProfileAsync(location, height, cancellationToken)
            : Task.FromResult<(HorizonProfileResult? Profile, HorizonPoint[] Points, bool Unavailable)>((null, [], false));
        var ephemerisTask = _ephemeris.GetAsync(request.Location, altitude.Kilometers, request.Period, cancellationToken);
        await Task.WhenAll(profileTask, ephemerisTask);

        var (profile, points, profileUnavailable) = await profileTask;
        var observations = await ephemerisTask;

        if (profileUnavailable)
            warnings.Add("Terrain horizon provider is unavailable.");
        if (request.Location.Latitude == -90)
            warnings.Add("Azimuth is singular at the exact pole; terrain visibility requires a reviewed meridian convention.");
        if (profile is not null) warnings.AddRange(profile.Warnings);
        var regionalApplied = altitude.TerrainDatumVerified && ValidProfile(profile, height, points);
        var regionalOnly = regionalApplied && profile!.IsRegionalOnly;
        var terrainApplied = regionalApplied && !regionalOnly;
        if (regionalOnly)
            warnings.Add("Reviewed DEM regional horizon and regional clearance are provided, but global skyline completeness is unproven. All visibility and summary metrics remain unknown; quality.terrainApplied=false denotes no complete visibility solution, not absence of DEM sampling.");
        if (!regionalApplied)
            warnings.Add("Terrain visibility is indeterminate; visible, clearance and summary metrics are unknown.");
        ValidateObservations(observations, RequestValidation.SampleTimes(request.Period));
        var samples = new AnalysisSample[observations.Count];
        var nearHorizon = false;
        for (var index = 0; index < observations.Count; index++)
        {
            var value = observations[index];
            var sunPos = Position(value.SunAzimuthDegrees, value.SunElevationDegrees);
            var earthPos = Position(value.EarthAzimuthDegrees, value.EarthElevationDegrees);
            if (terrainApplied && !nearHorizon &&
                (Math.Abs(sunPos.ClearanceDeg!.Value) < 0.001 || Math.Abs(earthPos.ClearanceDeg!.Value) < 0.001))
            {
                nearHorizon = true;
            }
            samples[index] = new AnalysisSample(value.Time, sunPos, earthPos);
        }
        if (nearHorizon)
            warnings.Add("Near-horizon visibility is sensitive to terrain resolution and sampling error.");
        IReadOnlyList<VisibilityInterval> sun = terrainApplied ? VisibilityCalculator.GetIntervals(samples, sample => sample.Sun) : [];
        IReadOnlyList<VisibilityInterval> earth = terrainApplied ? VisibilityCalculator.GetIntervals(samples, sample => sample.Earth) : [];
        var durationHours = (request.Period.EndUtc - request.Period.StartUtc).TotalHours;
        AnalysisSummary summary;
        if (terrainApplied)
        {
            var sunHours = VisibilityCalculator.Hours(sun);
            var earthHours = VisibilityCalculator.Hours(earth);
            summary = new AnalysisSummary(sunHours, earthHours,
                VisibilityCalculator.BothHours(sun, earth),
                Math.Clamp(100 * sunHours / durationHours, 0, 100),
                Math.Clamp(100 * earthHours / durationHours, 0, 100));
        }
        else
        {
            summary = new AnalysisSummary(null, null, null, null, null);
        }
        warnings.Add("Center-of-disk airless apparent positions; intervals use linear clearance interpolation at the requested sampling resolution, not an exact event solver.");
        return new AnalysisResponse(terrainApplied ? "complete" : "partial",
            new AnalysisLocation(location.Latitude, location.Longitude,
                height.ElevationM is { } elevation && double.IsFinite(elevation) ? elevation : null),
            request.Period, summary, samples, new AnalysisIntervals(sun, earth),
            regionalApplied && options.IncludeHorizon ? new HorizonResponse(points) : null,
            new AnalysisQuality("JPL Horizons", height.TerrainSource, terrainApplied,
                height.ResolutionMeters is > 0 && double.IsFinite(height.ResolutionMeters.Value) ? height.ResolutionMeters : null,
                regionalOnly
                    ? "center-of-disk airless apparent; finite-range regional DEM skyline; global visibility unknown"
                    : "center-of-disk airless apparent; cyclic terrain interpolation; linear clearance crossings",
                warnings.Distinct(StringComparer.Ordinal).ToArray()));

        BodyPosition Position(double azimuth, double elevation)
        {
            if (!regionalApplied) return new BodyPosition(azimuth, elevation, null, null, null);
            var horizon = VisibilityCalculator.InterpolateHorizon(points, azimuth);
            var clearance = elevation - horizon;
            return new BodyPosition(azimuth, elevation, horizon, clearance, regionalOnly ? null : clearance > 0);
        }
    }

    private async Task<(HorizonProfileResult? Profile, HorizonPoint[] Points, bool Unavailable)> TryGetProfileAsync(
        TerrainLocation location, TerrainHeightResult height, CancellationToken token)
    {
        try
        {
            var (profile, points) = await GetProfileAsync(location, height, token);
            return (profile, points, false);
        }
        catch (Exception exception) when (exception is IOException or TimeoutException)
        {
            return (null, [], true);
        }
    }

    private async Task<(HorizonProfileResult Profile, HorizonPoint[] SortedPoints)> GetProfileAsync(
        TerrainLocation location, TerrainHeightResult height, CancellationToken token)
    {
        var key = new ProfileKey(location, height.ElevationM, height.TerrainSource, height.VerticalReference, height.ResolutionMeters);
        var now = DateTimeOffset.UtcNow;
        if (_profiles.TryGetValue(key, out var fastHit) && fastHit.Expires > now)
            return (fastHit.Profile, fastHit.SortedPoints);

        var gate = _profileGates[(uint)key.GetHashCode() % ProfileGateStripes];
        await gate.WaitAsync(token);
        try
        {
            now = DateTimeOffset.UtcNow;
            if (_profiles.TryGetValue(key, out var cached) && cached.Expires > now)
                return (cached.Profile, cached.SortedPoints);
            var profile = await _horizons.GetProfileAsync(location, token);
            var sortedPoints = profile.Points?.OrderBy(point => point.AzimuthDeg).ToArray() ?? [];
            if (_profiles.Count >= 128) _profiles.Clear();
            // There is no revision token in the frozen provider interface. Cache only profiles for 60s, never whole analyses.
            if (profile.TerrainApplied) _profiles[key] = (DateTimeOffset.UtcNow.AddSeconds(60), profile, sortedPoints);
            return (profile, sortedPoints);
        }
        finally { gate.Release(); }
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

    public void Dispose()
    {
        foreach (var gate in _profileGates) gate.Dispose();
    }

    private sealed record ProfileKey(TerrainLocation Location, double? Elevation, string? Source, string? Datum, double? Resolution);
}
