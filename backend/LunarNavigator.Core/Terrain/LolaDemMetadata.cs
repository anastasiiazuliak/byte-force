namespace LunarNavigator.Core.Terrain;

/// <summary>
/// Immutable metadata and spatial extents for the NASA LOLA South Pole DEM dataset (LDEM_80S_80MPP_ADJ).
/// </summary>
public sealed record LolaDemMetadata
{
    public string DatasetName { get; init; } = "LDEM_80S_80MPP_ADJ";
    public string Description { get; init; } = "NASA LOLA Adjusted South Pole Digital Elevation Model (80°S-90°S)";
    public string VerticalReference { get; init; } = "Moon (2015) Sphere R=1737400m";
    public double MoonRadiusMeters { get; init; } = 1737400.0;

    public int RasterWidth { get; init; } = 7600;
    public int RasterHeight { get; init; } = 7600;
    public int TileWidth { get; init; } = 512;
    public int TileHeight { get; init; } = 512;

    public double MinX { get; init; } = -304000.0;
    public double MaxX { get; init; } = 304000.0;
    public double MinY { get; init; } = -304000.0;
    public double MaxY { get; init; } = 304000.0;

    public bool RasterPixelIsArea { get; init; }

    public double PixelScaleMeters { get; init; } = 80.0;
    public float NoDataValue { get; init; } = float.NaN;

    public double MinLatitudeDeg { get; init; } = -90.0;
    public double MaxLatitudeDeg { get; init; } = -80.0;

    public int TilesAcross => (RasterWidth + TileWidth - 1) / TileWidth;
    public int TilesDown => (RasterHeight + TileHeight - 1) / TileHeight;
    public int TotalTiles => TilesAcross * TilesDown;

    /// <summary>
    /// Checks whether the given projected coordinate falls within the raster bounding box.
    /// </summary>
    public bool ContainsProjected(double x, double y)
    {
        return x >= MinX && x <= MaxX && y >= MinY && y <= MaxY;
    }

    /// <summary>
    /// Checks whether the given raster pixel coordinates fall within image dimensions.
    /// </summary>
    public bool ContainsPixel(int col, int row)
    {
        return col >= 0 && col < RasterWidth && row >= 0 && row < RasterHeight;
    }

    /// <summary>
    /// Default metadata matching the official NASA PGDA product 90 specification.
    /// </summary>
    public static readonly LolaDemMetadata Default = new();
}
