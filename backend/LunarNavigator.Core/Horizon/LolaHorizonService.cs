using System.Collections.Concurrent;
using System.Diagnostics;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Terrain;

namespace LunarNavigator.Core.Horizon;

/// <summary>
/// Computes 360-degree terrain horizon elevation profiles from LOLA DEM data,
/// accounting for lunar spherical curvature and South Polar azimuth conventions (DATA-02).
/// </summary>
public sealed class LolaHorizonService : IHorizonService
{
    private readonly ITerrainService _terrain;
    private readonly HorizonOptions _defaultOptions;
    private readonly string _datasetKey;
    private readonly ConcurrentDictionary<string, HorizonProfileResult> _cache = new();
    private readonly ConcurrentQueue<string> _cacheOrder = new();

    public LolaHorizonService(
        ITerrainService terrain,
        HorizonOptions? defaultOptions = null,
        string datasetKey = "LOLA_80S_80MPP")
    {
        _terrain = terrain ?? throw new ArgumentNullException(nameof(terrain));
        _defaultOptions = defaultOptions ?? HorizonOptions.Default;
        _datasetKey = datasetKey;
    }

    public Task<HorizonProfileResult> GetProfileAsync(
        TerrainLocation location,
        CancellationToken cancellationToken = default) =>
        GetProfileAsync(location, _defaultOptions, cancellationToken);

    public async Task<HorizonProfileResult> GetProfileAsync(
        TerrainLocation location,
        HorizonOptions? options,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var opts = options ?? _defaultOptions;
        ValidateOptions(opts);

        if (!_terrain.IsAvailable)
        {
            return new HorizonProfileResult(
                Array.Empty<HorizonPoint>(),
                TerrainApplied: false,
                TerrainSource: null,
                ResolutionMeters: null,
                Warnings: new[] { "Terrain service is unavailable; horizon profile cannot be computed." });
        }

        string cacheKey = BuildCacheKey(location, opts);
        if (_cache.TryGetValue(cacheKey, out var cached))
        {
            return cached;
        }

        // First query center height to verify coverage & obtain vertical reference
        var centerHeight = await _terrain.GetElevationAsync(location, cancellationToken).ConfigureAwait(false);
        if (centerHeight.ElevationM is not double centerElevM || !double.IsFinite(centerElevM))
        {
            return new HorizonProfileResult(
                Array.Empty<HorizonPoint>(),
                TerrainApplied: false,
                TerrainSource: centerHeight.TerrainSource,
                ResolutionMeters: centerHeight.ResolutionMeters,
                Warnings: new[] { "Observer location has NoData or lies outside DEM bounds; horizon is indeterminate." });
        }

        double pixelScale = centerHeight.ResolutionMeters is > 0 ? centerHeight.ResolutionMeters.Value : 80.0;
        int radiusPixels = (int)Math.Ceiling(opts.MaxRangeMeters / pixelScale) + 2;

        var window = await _terrain.GetWindowAsync(
            new TerrainWindowRequest(location, radiusPixels, Stride: 1),
            cancellationToken).ConfigureAwait(false);

        if (window.Elevations.Length == 0 || window.Columns < 3 || window.Rows < 3)
        {
            return new HorizonProfileResult(
                Array.Empty<HorizonPoint>(),
                TerrainApplied: false,
                TerrainSource: centerHeight.TerrainSource,
                ResolutionMeters: pixelScale,
                Warnings: window.Warnings.Count > 0
                    ? window.Warnings
                    : new[] { "DEM window extraction returned empty data; horizon cannot be computed." });
        }

        var profile = ComputeHorizonFromWindow(location, centerElevM, window, opts, centerHeight.TerrainSource, cancellationToken);
        if (profile.Points.Count > 0 && profile.TerrainApplied)
        {
            CacheResult(cacheKey, profile, opts.MaxCachedProfiles);
        }

        return profile;
    }

    public double GetElevationAtAzimuth(HorizonProfileResult profile, double azimuthDeg)
    {
        if (profile.Points.Count == 0)
        {
            throw new InvalidOperationException("Cannot interpolate azimuth on an empty horizon profile.");
        }

        double az = NormalizeAzimuth(azimuthDeg);
        var points = profile.Points;
        if (points.Count == 1)
        {
            return points[0].ElevationDeg;
        }

        return VisibilityCalculator.InterpolateHorizon(points, az);
    }

    private static HorizonProfileResult ComputeHorizonFromWindow(
        TerrainLocation location,
        double centerElevM,
        TerrainWindowResult window,
        HorizonOptions opts,
        string? terrainSource,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        double resM = window.ResolutionMeters > 0 ? window.ResolutionMeters : 80.0;
        int cols = window.Columns;
        int rows = window.Rows;
        double centerCol = (cols - 1) / 2.0;
        double centerRow = (rows - 1) / 2.0;

        // Polar local North & East unit vectors in projected (X, Y) plane (ARC-03)
        var (obsX, obsY) = LunarProjection.ToProjected(location.Latitude, location.Longitude);
        var (northX, northY, eastX, eastY) = GetPolarLocalBasis(obsX, obsY);

        double r0 = LunarProjection.MoonRadiusMeters + centerElevM + opts.ObserverHeightOffsetMeters;
        double rayStep = Math.Max(1.0, opts.RayStepMeters);
        double maxRange = opts.MaxRangeMeters;

        int rayCount = Math.Max(1, (int)Math.Ceiling(360.0 / opts.AzimuthStepDeg));
        var points = new List<HorizonPoint>(rayCount);

        bool encounteredNoData = false;
        bool clippedRay = false;
        bool timedOut = false;

        for (int i = 0; i < rayCount; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (opts.MaxComputeMilliseconds > 0 && stopwatch.ElapsedMilliseconds > opts.MaxComputeMilliseconds)
            {
                timedOut = true;
                break;
            }

            double azDeg = i * opts.AzimuthStepDeg;
            if (azDeg >= 360.0)
            {
                break;
            }

            double azRad = azDeg * (Math.PI / 180.0);
            double dirX = (Math.Cos(azRad) * northX) + (Math.Sin(azRad) * eastX);
            double dirY = (Math.Cos(azRad) * northY) + (Math.Sin(azRad) * eastY);

            double maxElevDeg = -90.0;
            bool hasValidSample = false;

            for (double dist = rayStep; dist <= maxRange; dist += rayStep)
            {
                double dx = dist * dirX;
                double dy = dist * dirY;
                double colF = centerCol + (dx / resM);
                double rowF = centerRow - (dy / resM); // projected +Y points up, raster row increases down

                if (colF < 0 || colF > cols - 1 || rowF < 0 || rowF > rows - 1)
                {
                    clippedRay = true;
                    break;
                }

                if (!TrySampleBilinear(window.Elevations, cols, rows, colF, rowF, out double sampleElevM))
                {
                    encounteredNoData = true;
                    continue;
                }

                hasValidSample = true;
                double psi = dist / LunarProjection.MoonRadiusMeters;
                double rs = LunarProjection.MoonRadiusMeters + sampleElevM;
                double elevRad = Math.Atan2((rs * Math.Cos(psi)) - r0, rs * Math.Sin(psi));
                double elevDeg = elevRad * (180.0 / Math.PI);

                if (elevDeg > maxElevDeg)
                {
                    maxElevDeg = elevDeg;
                }
            }

            if (!hasValidSample)
            {
                encounteredNoData = true;
                continue;
            }

            points.Add(new HorizonPoint(Math.Round(azDeg, 4), Math.Round(maxElevDeg, 4)));
        }

        var warnings = new List<string>
        {
            $"Horizon profile: azStep={opts.AzimuthStepDeg:0.##} deg, rayStep={rayStep:0.#} m, maxRange={maxRange / 1000.0:0.#} km, lunarSphereR={LunarProjection.MoonRadiusMeters:0} m."
        };
        if (encounteredNoData)
        {
            warnings.Add("Some ray samples contained DEM NoData and were skipped.");
        }
        if (clippedRay)
        {
            warnings.Add("One or more rays reached the DEM window boundary before maxRange.");
        }
        if (timedOut)
        {
            warnings.Add("Partial horizon profile returned: compute time budget exceeded.");
        }

        return new HorizonProfileResult(
            points,
            TerrainApplied: !timedOut && !encounteredNoData && !clippedRay && points.Count == rayCount,
            TerrainSource: terrainSource ?? "NASA LOLA DEM",
            ResolutionMeters: resM,
            Warnings: warnings);
    }

    internal static (double NorthX, double NorthY, double EastX, double EastY) GetPolarLocalBasis(double obsX, double obsY)
    {
        double rho = Math.Sqrt((obsX * obsX) + (obsY * obsY));
        if (rho <= 1e-6)
        {
            // ARC-03 South Pole (-90 deg) convention: 0 deg azimuth aligns with 0 deg meridian (+Y)
            return (0.0, 1.0, 1.0, 0.0);
        }

        // North points radially outward from the South Pole towards the equator; East is 90 deg clockwise (+lon)
        double northX = obsX / rho;
        double northY = obsY / rho;
        double eastX = obsY / rho;
        double eastY = -obsX / rho;
        return (northX, northY, eastX, eastY);
    }

    private static bool TrySampleBilinear(float[] grid, int cols, int rows, double colF, double rowF, out double elevation)
    {
        int c0 = (int)Math.Floor(colF);
        int r0 = (int)Math.Floor(rowF);
        int c1 = Math.Min(cols - 1, c0 + 1);
        int r1 = Math.Min(rows - 1, r0 + 1);

        float v00 = grid[(r0 * cols) + c0];
        float v10 = grid[(r0 * cols) + c1];
        float v01 = grid[(r1 * cols) + c0];
        float v11 = grid[(r1 * cols) + c1];

        if (!float.IsFinite(v00) || !float.IsFinite(v10) || !float.IsFinite(v01) || !float.IsFinite(v11))
        {
            elevation = double.NaN;
            return false;
        }

        double fc = colF - c0;
        double fr = rowF - r0;
        double top = v00 + (fc * (v10 - v00));
        double bottom = v01 + (fc * (v11 - v01));
        elevation = top + (fr * (bottom - top));
        return true;
    }

    private static double NormalizeAzimuth(double azimuthDeg)
    {
        double az = azimuthDeg % 360.0;
        return az < 0.0 ? az + 360.0 : az;
    }

    private static void ValidateOptions(HorizonOptions opts)
    {
        if (opts.AzimuthStepDeg is <= 0.0 or > 90.0)
            throw new ArgumentOutOfRangeException(nameof(opts.AzimuthStepDeg), "AzimuthStepDeg must be in (0, 90].");
        if (opts.MaxRangeMeters <= 0.0)
            throw new ArgumentOutOfRangeException(nameof(opts.MaxRangeMeters), "MaxRangeMeters must be positive.");
        if (opts.RayStepMeters <= 0.0)
            throw new ArgumentOutOfRangeException(nameof(opts.RayStepMeters), "RayStepMeters must be positive.");
    }

    private string BuildCacheKey(TerrainLocation loc, HorizonOptions opts) =>
        $"{_datasetKey}:{loc.Latitude:F6}:{loc.Longitude:F6}:{opts.AzimuthStepDeg:F3}:{opts.MaxRangeMeters:F1}:{opts.RayStepMeters:F1}:{opts.ObserverHeightOffsetMeters:F2}";

    private void CacheResult(string key, HorizonProfileResult value, int maxEntries)
    {
        if (maxEntries <= 0) return;
        if (_cache.TryAdd(key, value))
        {
            _cacheOrder.Enqueue(key);
            while (_cache.Count > maxEntries && _cacheOrder.TryDequeue(out var oldest))
            {
                _cache.TryRemove(oldest, out _);
            }
        }
    }
}
