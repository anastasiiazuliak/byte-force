using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Api.Tests.TestSupport;

/// <summary>Synthetic terrain only, confined to tests.</summary>
internal sealed class StubTerrain : ITerrainHeightProvider, IHorizonProfileProvider
{
    public TerrainHeightResult Height { get; init; } = new(120, "SYNTHETIC TEST ONLY",
        ObserverAltitudeResolver.HorizonsDatum, 80, true, []);
    public HorizonProfileResult Profile { get; init; } = new(
        Enumerable.Range(0, 360).Select(index => new HorizonPoint(index, 0)).ToArray(), true, "SYNTHETIC TEST ONLY", 80, []);
    public int ProfileCalls { get; private set; }

    public Task<TerrainHeightResult> GetHeightAsync(TerrainLocation location, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(Height);
    }

    public Task<HorizonProfileResult> GetProfileAsync(TerrainLocation location, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ProfileCalls++;
        return Task.FromResult(Profile);
    }
}
