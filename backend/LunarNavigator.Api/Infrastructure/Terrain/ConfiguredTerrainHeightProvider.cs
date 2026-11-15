using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Terrain;

namespace LunarNavigator.Api.Infrastructure.Terrain;

/// <summary>Approves only the identity-bound reviewed LOLA product; all other data remain unaligned.</summary>
public sealed class ConfiguredTerrainHeightProvider(ITerrainService terrain) : ITerrainHeightProvider
{
    private readonly ITerrainService _terrain = terrain;
    public bool HasReviewedDatumAlignment => _terrain is LolaTerrainService { HasReviewedDatumAlignment: true };

    public async Task<TerrainHeightResult> GetHeightAsync(TerrainLocation location, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_terrain.IsAvailable)
            return new TerrainHeightResult(null, null, null, null, false, ["Configured LOLA terrain is unavailable; check server data configuration."]);
        var value = await _terrain.GetElevationAsync(location, cancellationToken);
        var elevation = value.ElevationM is { } meters && double.IsFinite(meters) ? value.ElevationM : null;
        bool reviewed = elevation is not null && _terrain is LolaTerrainService { HasReviewedDatumAlignment: true };
        return value with
        {
            ElevationM = elevation,
            VerticalReference = reviewed ? ObserverAltitudeResolver.HorizonsDatum : value.VerticalReference,
            DatumAlignmentVerified = reviewed,
            Warnings = elevation is null
                ? ["LOLA elevation is NoData or outside available coverage; datum/frame alignment is unverified."]
                : reviewed
                    ? [$"LOLA radial-height datum reviewed against the exact opened DEM identity ({LolaTiffReader.DatumReviewId}); epoch applicability and global skyline completeness are separate gates."]
                    : ["LOLA elevation is available; this asset identity/metadata has no matching scientific review."]
        };
    }

}
