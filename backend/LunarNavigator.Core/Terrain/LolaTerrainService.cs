using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Terrain;

/// <summary>
/// Production implementation of <see cref="ITerrainService"/> and <see cref="ITerrainHeightProvider"/>
/// backed by NASA LOLA South Pole DEM GeoTIFF (DATA-01).
/// </summary>
public sealed class LolaTerrainService : ITerrainService, IDisposable
{
    private readonly string resolvedPath;
    private readonly LolaTiffReader? reader;
    private readonly LolaDemMetadata metadata;
    private readonly string? initWarning;
    private bool disposed;
    private volatile bool readFailed;

    public bool IsAvailable => reader != null && !readFailed;
    public bool HasReviewedDatumAlignment => IsAvailable && reader?.HasReviewedDatumAlignment == true;
    public string ResolvedPath => resolvedPath;
    public LolaDemMetadata Metadata => metadata;

    public LolaTerrainService(string? explicitPath = null)
    {
        resolvedPath = ResolvePath(explicitPath);
        metadata = LolaDemMetadata.Default;

        if (File.Exists(resolvedPath))
        {
            try
            {
                reader = LolaTiffReader.Open(resolvedPath);
                metadata = reader.Metadata;
                initWarning = null;
            }
            catch (Exception ex)
            {
                reader = null;
                initWarning = $"Failed to open LOLA DEM at '{resolvedPath}': {ex.Message}";
            }
        }
        else
        {
            reader = null;
            initWarning = $"NASA LOLA DEM file not found at '{resolvedPath}'. " +
                          "To obtain official NASA data, run: python data/scripts/download_data.py --download " +
                          "or configure the LUNAR_DEM_PATH environment variable.";
        }
    }

    public LolaTerrainService(LolaTiffReader customReader)
    {
        reader = customReader ?? throw new ArgumentNullException(nameof(customReader));
        metadata = customReader.Metadata;
        resolvedPath = "custom-reader";
        initWarning = null;
    }

    public Task<TerrainHeightResult> GetHeightAsync(
        TerrainLocation location, CancellationToken cancellationToken = default)
    {
        return GetElevationAsync(location, cancellationToken);
    }

    public Task<TerrainHeightResult> GetElevationAsync(
        TerrainLocation location, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (reader == null || readFailed)
        {
            return Task.FromResult(new TerrainHeightResult(
                null,
                null,
                null,
                null,
                false,
                new[] { initWarning ?? "LOLA DEM data could not be decoded; terrain is unavailable." }));
        }

        // Validate geographic coverage [-90, -80]
        if (!double.IsFinite(location.Latitude) || !double.IsFinite(location.Longitude) || location.Latitude < -90.0 || location.Latitude > -80.0)
        {
            return Task.FromResult(new TerrainHeightResult(
                null,
                metadata.DatasetName,
                metadata.VerticalReference,
                metadata.PixelScaleMeters,
                false,
                new[] { $"Latitude {location.Latitude}° is outside LOLA 80S coverage [{metadata.MinLatitudeDeg}, {metadata.MaxLatitudeDeg}]." }));
        }

        // Transform lat/lon to projected meters and raster pixels
        var (x, y) = LunarProjection.ToProjected(location.Latitude, location.Longitude);
        var (colD, rowD) = LunarProjection.ToPixel(x, y, metadata);

        if (colD < 0 || colD > metadata.RasterWidth - 1 || rowD < 0 || rowD > metadata.RasterHeight - 1)
        {
            return Task.FromResult(new TerrainHeightResult(
                null,
                metadata.DatasetName,
                metadata.VerticalReference,
                metadata.PixelScaleMeters,
                false,
                new[] { $"Location ({location.Latitude}°, {location.Longitude}°) projects outside the DEM sample-center support; extrapolation is not permitted." }));
        }

        if (!BilinearDemSurface.TrySample(metadata.RasterWidth, metadata.RasterHeight, colD, rowD,
            ReadPixel, out double elev))
        {
            return Task.FromResult(new TerrainHeightResult(
                null,
                metadata.DatasetName,
                metadata.VerticalReference,
                metadata.PixelScaleMeters,
                false,
                new[] { readFailed ? "LOLA DEM data could not be decoded; terrain is unavailable." : "NoData elevation at location." }));
        }

        return Task.FromResult(new TerrainHeightResult(
            elev,
            metadata.DatasetName,
            metadata.VerticalReference,
            metadata.PixelScaleMeters,
            false,
            new[] { "DEM frame and vertical-reference alignment to Horizons has not been verified." }));
    }

    public Task<TerrainWindowResult> GetWindowAsync(
        TerrainWindowRequest request, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (reader == null || readFailed)
        {
            return Task.FromResult(new TerrainWindowResult(
                request.CenterLocation,
                0,
                0,
                metadata.PixelScaleMeters,
                Array.Empty<float>(),
                null,
                null,
                true,
                new[] { initWarning ?? "LOLA DEM data could not be decoded; terrain is unavailable." }));
        }

        var (centerX, centerY) = LunarProjection.ToProjected(request.CenterLocation.Latitude, request.CenterLocation.Longitude);
        var (centerColD, centerRowD) = LunarProjection.ToPixel(centerX, centerY, metadata);
        int centerCol = (int)Math.Round(centerColD);
        int centerRow = (int)Math.Round(centerRowD);

        if (request.WindowRadiusPixels is < 1 or > 999)
            throw new ArgumentOutOfRangeException(nameof(request), "DEM window radius must be between 1 and 999 pixels.");
        int rad = request.WindowRadiusPixels;
        int startCol = centerCol - rad;
        int startRow = centerRow - rad;
        int width = (rad * 2) + 1;
        int height = (rad * 2) + 1;

        var samples = new float[width * height];
        double min = double.MaxValue;
        double max = double.MinValue;
        bool hasNoData = false;

        if (readFailed)
        {
            Array.Fill(samples, float.NaN);
            hasNoData = true;
        }
        else
        {
            try
            {
                reader!.ReadWindowFlat(startCol, startRow, width, height, samples);
            }
            catch (Exception exception) when (exception is IOException or InvalidDataException)
            {
                // Reject the dataset after a failed tile read; never use partially decoded elevations.
                readFailed = true;
                Array.Fill(samples, float.NaN);
                hasNoData = true;
            }
        }

        if (!readFailed)
        {
            for (int i = 0; i < samples.Length; i++)
            {
                float val = samples[i];
                if (float.IsNaN(val))
                {
                    hasNoData = true;
                }
                else
                {
                    if (val < min) min = val;
                    if (val > max) max = val;
                }
            }
        }

        var (originX, originY) = LunarProjection.FromPixel(startCol, startRow, metadata);
        return Task.FromResult(new TerrainWindowResult(
            request.CenterLocation,
            width,
            height,
            metadata.PixelScaleMeters,
            samples,
            min == double.MaxValue ? null : Math.Round(min, 2),
            max == double.MinValue ? null : Math.Round(max, 2),
            hasNoData,
            readFailed ? new[] { "LOLA DEM data could not be decoded; terrain is unavailable." } : Array.Empty<string>())
        {
            OriginX = originX,
            OriginY = originY
        });
    }

    private float ReadPixel(int col, int row)
    {
        if (readFailed) return float.NaN;
        try { return reader!.ReadPixel(col, row); }
        catch (Exception exception) when (exception is IOException or InvalidDataException)
        {
            // Reject the dataset after a failed tile read; never use partially decoded elevations.
            readFailed = true;
            return float.NaN;
        }
    }

    private static string ResolvePath(string? explicitPath)
    {
        if (!string.IsNullOrWhiteSpace(explicitPath))
        {
            return Path.GetFullPath(explicitPath);
        }

        var envFile = Environment.GetEnvironmentVariable("LUNAR_DEM_PATH");
        if (!string.IsNullOrWhiteSpace(envFile))
        {
            return Path.GetFullPath(envFile);
        }

        var envDir = Environment.GetEnvironmentVariable("LUNAR_DATA_DIR");
        if (!string.IsNullOrWhiteSpace(envDir))
        {
            return Path.GetFullPath(Path.Combine(envDir, "LDEM_80S_80MPP_ADJ.TIF"));
        }

        // Search common repository relative locations
        string[] candidates =
        {
            Path.Combine(AppContext.BaseDirectory, "data", "raw", "LDEM_80S_80MPP_ADJ.TIF"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "data", "raw", "LDEM_80S_80MPP_ADJ.TIF"),
            Path.Combine(Directory.GetCurrentDirectory(), "data", "raw", "LDEM_80S_80MPP_ADJ.TIF"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "data", "raw", "LDEM_80S_80MPP_ADJ.TIF")
        };

        foreach (var c in candidates)
        {
            var full = Path.GetFullPath(c);
            if (File.Exists(full))
            {
                return full;
            }
        }

        return Path.GetFullPath(candidates[0]);
    }

    public void Dispose()
    {
        if (!disposed)
        {
            disposed = true;
            reader?.Dispose();
        }
    }
}
