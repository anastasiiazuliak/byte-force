using System.Collections.Concurrent;
using System.Diagnostics;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Terrain;

namespace LunarNavigator.Core.Horizon;

/// <summary>
/// Computes 360-degree terrain horizon elevation profiles from LOLA DEM data,
/// accounting for lunar spherical curvature and South Polar azimuth conventions.
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
        int radiusPixels = (int)Math.Ceiling(opts.MaxRangeMeters * 1.02 / pixelScale) + 2;

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
        float[] elevations = window.Elevations;
        double centerCol = (cols - 1) / 2.0;
        double centerRow = (rows - 1) / 2.0;

        // Retain the observer offset relative to the snapped raster window origin.
        var (obsX, obsY) = LunarProjection.ToProjected(location.Latitude, location.Longitude);
        double originX = window.OriginX ?? obsX - centerCol * resM;
        double originY = window.OriginY ?? obsY + centerRow * resM;

        double r0 = LunarProjection.MoonRadiusMeters + centerElevM + opts.ObserverHeightOffsetMeters;
        double rayStep = Math.Max(1.0, opts.RayStepMeters);
        double maxRange = opts.MaxRangeMeters;

        int rayCount = Math.Max(1, (int)Math.Ceiling(360.0 / opts.AzimuthStepDeg));
        int activeRayCount = rayCount;
        while (activeRayCount > 0 && (activeRayCount - 1) * opts.AzimuthStepDeg >= 360.0)
        {
            activeRayCount--;
        }

        int stepCount = (int)Math.Floor((maxRange / rayStep) + 1e-12);
        var cosPsi = new double[stepCount];
        var sinPsi = new double[stepCount];
        const double invR = 1.0 / LunarProjection.MoonRadiusMeters;
        for (int s = 0; s < stepCount; s++)
        {
            double psi = (s + 1) * rayStep * invR;
            cosPsi[s] = Math.Cos(psi);
            sinPsi[s] = Math.Sin(psi);
        }

        const double degToRad = Math.PI / 180.0;
        const double radToDeg = 180.0 / Math.PI;
        const double twoR = 2.0 * LunarProjection.MoonRadiusMeters;
        double obsLatRad = location.Latitude * degToRad;
        double obsLonRad = location.Longitude * degToRad;
        double sinLat = Math.Sin(obsLatRad), cosLat = Math.Cos(obsLatRad);
        double sinLon = Math.Sin(obsLonRad), cosLon = Math.Cos(obsLonRad);
        double obsCartX = cosLat * cosLon;
        double obsCartY = cosLat * sinLon;
        double obsCartZ = sinLat;

        // Precompute local North/East unit basis vectors on the reference sphere.
        double northX = -sinLat * cosLon;
        double northY = -sinLat * sinLon;
        double northZ = cosLat;
        double eastX = -sinLon;
        double eastY = cosLon;

        double maxColF = cols - 1;
        double maxRowF = rows - 1;
        double invResM = 1.0 / resM;

        var rayPoints = new HorizonPoint?[activeRayCount];
        int encounteredNoDataFlag = 0;
        int clippedRayFlag = 0;
        int timedOutFlag = 0;
        long maxComputeMs = opts.MaxComputeMilliseconds;

        void ProcessRay(int i)
        {
            double azDeg = i * opts.AzimuthStepDeg;
            double azRad = azDeg * degToRad;
            double cosAz = Math.Cos(azRad);
            double sinAz = Math.Sin(azRad);

            double tx = (cosAz * northX) + (sinAz * eastX);
            double ty = (cosAz * northY) + (sinAz * eastY);
            double tz = cosAz * northZ;

            double maxSlope = double.NegativeInfinity;
            double maxFallbackElevRad = double.NegativeInfinity;
            bool hasValidSample = false;
            bool rayNoData = false;
            bool rayClipped = false;

            for (int s = 0; s < stepCount; s++)
            {
                double cp = cosPsi[s];
                double sp = sinPsi[s];

                double dx = (obsCartX * cp) + (tx * sp);
                double dy = (obsCartY * cp) + (ty * sp);
                double dz = (obsCartZ * cp) + (tz * sp);

                // Closed-form South Polar Stereographic projection from unit cartesian sphere point (dx, dy, dz).
                double denom = 1.0 - dz;
                double sampleX, sampleY;
                if (denom <= 1e-15)
                {
                    sampleX = 0.0;
                    sampleY = 0.0;
                }
                else
                {
                    double scale = twoR / denom;
                    sampleX = scale * dy;
                    sampleY = scale * dx;
                }

                double colF = (sampleX - originX) * invResM;
                double rowF = (originY - sampleY) * invResM;

                if (!double.IsFinite(colF) || !double.IsFinite(rowF)
                    || colF < 0 || colF > maxColF || rowF < 0 || rowF > maxRowF)
                {
                    rayClipped = true;
                    break;
                }

                if (!TrySampleFlat(elevations, cols, rows, colF, rowF, out double sampleElevM))
                {
                    rayNoData = true;
                    continue;
                }

                hasValidSample = true;
                double rs = LunarProjection.MoonRadiusMeters + sampleElevM;
                double yNum = (rs * cp) - r0;
                double xDen = rs * sp;
                if (xDen > 0.0)
                {
                    double slope = yNum / xDen;
                    if (slope > maxSlope)
                    {
                        maxSlope = slope;
                    }
                }
                else
                {
                    double elevRad = Math.Atan2(yNum, xDen);
                    if (elevRad > maxFallbackElevRad)
                    {
                        maxFallbackElevRad = elevRad;
                    }
                }
            }

            if (rayNoData) Interlocked.CompareExchange(ref encounteredNoDataFlag, 1, 0);
            if (rayClipped) Interlocked.CompareExchange(ref clippedRayFlag, 1, 0);

            if (!hasValidSample)
            {
                Interlocked.CompareExchange(ref encounteredNoDataFlag, 1, 0);
                return;
            }

            double bestElevRad = double.IsNegativeInfinity(maxFallbackElevRad)
                ? Math.Atan(maxSlope)
                : (double.IsNegativeInfinity(maxSlope)
                    ? maxFallbackElevRad
                    : Math.Max(Math.Atan(maxSlope), maxFallbackElevRad));

            rayPoints[i] = new HorizonPoint(Math.Round(azDeg, 4), Math.Round(bestElevRad * radToDeg, 4));
        }

        if (activeRayCount >= 32 && stepCount >= 16 && maxComputeMs <= 0)
        {
            Parallel.For(0, activeRayCount, new ParallelOptions { CancellationToken = cancellationToken }, ProcessRay);
        }
        else if (activeRayCount >= 32 && stepCount >= 16)
        {
            Parallel.For(0, activeRayCount, new ParallelOptions { CancellationToken = cancellationToken }, (i, loopState) =>
            {
                if (Volatile.Read(ref timedOutFlag) != 0 || stopwatch.ElapsedMilliseconds > maxComputeMs)
                {
                    Volatile.Write(ref timedOutFlag, 1);
                    loopState.Stop();
                    return;
                }
                ProcessRay(i);
            });
        }
        else
        {
            for (int i = 0; i < activeRayCount; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (maxComputeMs > 0 && stopwatch.ElapsedMilliseconds > maxComputeMs)
                {
                    timedOutFlag = 1;
                    break;
                }
                ProcessRay(i);
            }
        }

        var points = new List<HorizonPoint>(activeRayCount);
        for (int i = 0; i < activeRayCount; i++)
        {
            if (rayPoints[i] is { } point)
            {
                points.Add(point);
            }
        }

        bool encounteredNoData = encounteredNoDataFlag != 0;
        bool clippedRay = clippedRayFlag != 0;
        bool timedOut = timedOutFlag != 0;

        var warnings = new List<string>
        {
            $"Horizon profile: azStep={opts.AzimuthStepDeg:0.##} deg, rayStep={rayStep:0.#} m, maxRange={maxRange / 1000.0:0.#} km, lunarSphereR={LunarProjection.MoonRadiusMeters:0} m."
        };
        warnings.Add("Observer and ray heights use the same bilinear DEM surface model; subpixel physical accuracy is not established.");
        warnings.Add("Finite-range sampled horizon only: unsampled ridges and terrain beyond maxRange may obstruct the target; clear samples are not proof of global visibility.");
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
            Warnings: warnings) { IsRegionalOnly = true };
    }

    private static bool TrySampleFlat(
        float[] elevations, int columns, int rows, double column, double row, out double elevation)
    {
        int c0 = (int)Math.Floor(column);
        int r0 = (int)Math.Floor(row);
        int c1 = Math.Min(columns - 1, c0 + 1);
        int r1 = Math.Min(rows - 1, r0 + 1);
        double fc = column - c0;
        double fr = row - r0;
        double oneMinusFc = 1.0 - fc;
        double oneMinusFr = 1.0 - fr;

        int row0Offset = r0 * columns;
        int row1Offset = r1 * columns;
        double sum = 0.0;

        double w00 = oneMinusFc * oneMinusFr;
        if (w00 != 0.0)
        {
            float v = elevations[row0Offset + c0];
            if (!float.IsFinite(v)) { elevation = double.NaN; return false; }
            sum += w00 * v;
        }

        double w10 = fc * oneMinusFr;
        if (w10 != 0.0)
        {
            float v = elevations[row0Offset + c1];
            if (!float.IsFinite(v)) { elevation = double.NaN; return false; }
            sum += w10 * v;
        }

        double w01 = oneMinusFc * fr;
        if (w01 != 0.0)
        {
            float v = elevations[row1Offset + c0];
            if (!float.IsFinite(v)) { elevation = double.NaN; return false; }
            sum += w01 * v;
        }

        double w11 = fc * fr;
        if (w11 != 0.0)
        {
            float v = elevations[row1Offset + c1];
            if (!float.IsFinite(v)) { elevation = double.NaN; return false; }
            sum += w11 * v;
        }

        elevation = sum;
        return true;
    }

    /// <summary>Great-circle destination on the reference sphere; azimuth is north through east.</summary>
    public static TerrainLocation Destination(TerrainLocation observer, double azimuthDeg, double distanceMeters)
    {
        double lat = observer.Latitude * Math.PI / 180;
        double lon = observer.Longitude * Math.PI / 180;
        double az = azimuthDeg * Math.PI / 180;
        double psi = distanceMeters / LunarProjection.MoonRadiusMeters;
        // Cartesian tangent basis avoids the longitude singularity at the South Pole.
        double x = Math.Cos(lat) * Math.Cos(lon), y = Math.Cos(lat) * Math.Sin(lon), z = Math.Sin(lat);
        double tx = -Math.Cos(az) * Math.Sin(lat) * Math.Cos(lon) - Math.Sin(az) * Math.Sin(lon);
        double ty = -Math.Cos(az) * Math.Sin(lat) * Math.Sin(lon) + Math.Sin(az) * Math.Cos(lon);
        double tz = Math.Cos(az) * Math.Cos(lat);
        double dx = x * Math.Cos(psi) + tx * Math.Sin(psi);
        double dy = y * Math.Cos(psi) + ty * Math.Sin(psi);
        double dz = z * Math.Cos(psi) + tz * Math.Sin(psi);
        return new TerrainLocation(Math.Atan2(dz, Math.Sqrt(dx * dx + dy * dy)) * 180 / Math.PI,
            Math.Atan2(dy, dx) * 180 / Math.PI);
    }

    internal static (double NorthX, double NorthY, double EastX, double EastY) GetPolarLocalBasis(double obsX, double obsY)
    {
        double rho = Math.Sqrt((obsX * obsX) + (obsY * obsY));
        if (rho <= 1e-6)
        {
            // South Pole (-90 deg) convention: 0 deg azimuth aligns with 0 deg meridian (+Y)
            return (0.0, 1.0, 1.0, 0.0);
        }

        // North points radially outward from the South Pole towards the equator; East is 90 deg clockwise (+lon)
        double northX = obsX / rho;
        double northY = obsY / rho;
        double eastX = obsY / rho;
        double eastY = -obsX / rho;
        return (northX, northY, eastX, eastY);
    }

    private static double NormalizeAzimuth(double azimuthDeg)
    {
        double az = azimuthDeg % 360.0;
        return az < 0.0 ? az + 360.0 : az;
    }

    private static void ValidateOptions(HorizonOptions opts)
    {
        if (!double.IsFinite(opts.AzimuthStepDeg) || opts.AzimuthStepDeg is < 0.1 or > 90.0)
            throw new ArgumentOutOfRangeException(nameof(opts.AzimuthStepDeg), "AzimuthStepDeg must be in (0, 90].");
        if (!double.IsFinite(opts.MaxRangeMeters) || opts.MaxRangeMeters is <= 0.0 or > 60_000.0)
            throw new ArgumentOutOfRangeException(nameof(opts.MaxRangeMeters), "MaxRangeMeters must be positive.");
        if (!double.IsFinite(opts.RayStepMeters) || opts.RayStepMeters < 1.0)
            throw new ArgumentOutOfRangeException(nameof(opts.RayStepMeters), "Ray step must be finite and at least 1 m.");
        if (!double.IsFinite(opts.ObserverHeightOffsetMeters) || opts.ObserverHeightOffsetMeters < 0)
            throw new ArgumentOutOfRangeException(nameof(opts.ObserverHeightOffsetMeters));
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
