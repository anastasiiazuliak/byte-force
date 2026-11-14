using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Terrain;

/// <summary>
/// Request for a rectangular elevation window surrounding a given center point or pixel bounding box.
/// </summary>
public sealed record TerrainWindowRequest(
    TerrainLocation CenterLocation,
    int WindowRadiusPixels = 5,
    int Stride = 1);

/// <summary>
/// Result of an elevation window extraction containing grid points and stats.
/// </summary>
public sealed record TerrainWindowResult(
    TerrainLocation Center,
    int Columns,
    int Rows,
    double ResolutionMeters,
    float[] Elevations,
    double? MinElevationM,
    double? MaxElevationM,
    bool ContainsNoData,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Core contract for querying digital elevation data from lunar terrain models (DATA-01).
/// </summary>
public interface ITerrainService : ITerrainHeightProvider
{
    /// <summary>
    /// Checks whether the terrain data source is currently accessible.
    /// </summary>
    bool IsAvailable { get; }

    /// <summary>
    /// Gets the elevation at the specified lunar geographic location.
    /// </summary>
    Task<TerrainHeightResult> GetElevationAsync(
        TerrainLocation location, CancellationToken cancellationToken = default);

    /// <summary>
    /// Extracts a localized 2D raster window of elevation samples around a center location.
    /// </summary>
    Task<TerrainWindowResult> GetWindowAsync(
        TerrainWindowRequest request, CancellationToken cancellationToken = default);
}
