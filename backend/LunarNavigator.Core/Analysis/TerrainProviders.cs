namespace LunarNavigator.Core.Analysis;

// Coordinates are degrees; heights are meters in the dataset's stated vertical reference.
public sealed record TerrainLocation(double Latitude, double Longitude);

public sealed record TerrainHeightResult(
    double? ElevationM,
    string? TerrainSource,
    string? VerticalReference,
    double? ResolutionMeters,
    bool DatumAlignmentVerified,
    IReadOnlyList<string> Warnings);

public sealed record HorizonPoint(double AzimuthDeg, double ElevationDeg);

public sealed record HorizonProfileResult(
    IReadOnlyList<HorizonPoint> Points,
    bool TerrainApplied,
    string? TerrainSource,
    double? ResolutionMeters,
    IReadOnlyList<string> Warnings);

public interface ITerrainHeightProvider
{
    Task<TerrainHeightResult> GetHeightAsync(
        TerrainLocation location, CancellationToken cancellationToken = default);
}

public interface IHorizonProfileProvider
{
    Task<HorizonProfileResult> GetProfileAsync(
        TerrainLocation location, CancellationToken cancellationToken = default);
}

public sealed class UnavailableTerrainHeightProvider : ITerrainHeightProvider
{
    public Task<TerrainHeightResult> GetHeightAsync(
        TerrainLocation location, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(new TerrainHeightResult(null, null, null, null, false,
            new[] { "Terrain provider unavailable; elevation and datum alignment are unknown." }));
    }
}

public sealed class UnavailableHorizonProfileProvider : IHorizonProfileProvider
{
    public Task<HorizonProfileResult> GetProfileAsync(
        TerrainLocation location, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(new HorizonProfileResult(Array.Empty<HorizonPoint>(), false, null, null,
            new[] { "Horizon provider unavailable; terrain visibility is indeterminate." }));
    }
}
