using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Terrain;

namespace LunarNavigator.Api.Infrastructure.Terrain;

/// <summary>Exposes DATA-01 heights without asserting an unreviewed frame/datum alignment or leaking internal paths.</summary>
public sealed class ConfiguredTerrainHeightProvider(ITerrainService terrain) : ITerrainHeightProvider, IDisposable
{
    private readonly ITerrainService _terrain = terrain;

    public async Task<TerrainHeightResult> GetHeightAsync(TerrainLocation location, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_terrain.IsAvailable)
            return new TerrainHeightResult(null, null, null, null, false, ["Configured LOLA terrain is unavailable; check server data configuration."]);
        var value = await _terrain.GetElevationAsync(location, cancellationToken);
        var elevation = value.ElevationM is { } meters && double.IsFinite(meters) ? value.ElevationM : null;
        return value with
        {
            ElevationM = elevation,
            // DATA-01 currently derives alignment from default metadata. A reviewed provider/adapter must replace this gate.
            DatumAlignmentVerified = false,
            Warnings = elevation is null
                ? ["LOLA elevation is NoData or outside available coverage; datum/frame alignment is unverified."]
                : ["LOLA elevation is available; datum/frame alignment to Horizons requires scientific review."]
        };
    }

    public void Dispose()
    {
        if (_terrain is IDisposable disposable) disposable.Dispose();
    }
}
