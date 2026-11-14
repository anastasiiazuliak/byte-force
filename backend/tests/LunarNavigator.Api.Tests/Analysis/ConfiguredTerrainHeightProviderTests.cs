using LunarNavigator.Api.Infrastructure.Terrain;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Api.Tests.Analysis;

public sealed class ConfiguredTerrainHeightProviderTests
{
    [Fact]
    public async Task Adapter_UnavailableDataDoesNotLeakProviderPaths()
    {
        using var adapter = new ConfiguredTerrainHeightProvider(new TestTerrain { IsAvailable = false });
        var result = await adapter.GetHeightAsync(new TerrainLocation(-89, 25));
        Assert.Null(result.ElevationM);
        Assert.False(result.DatumAlignmentVerified);
        Assert.DoesNotContain("secret-path", string.Join(" ", result.Warnings));
    }

    [Fact]
    public async Task Adapter_Data01AlignmentClaimRequiresSeparateScientificReview()
    {
        using var adapter = new ConfiguredTerrainHeightProvider(new TestTerrain());
        var result = await adapter.GetHeightAsync(new TerrainLocation(-89, 25));
        Assert.Equal(120, result.ElevationM);
        Assert.Equal("SYNTHETIC TEST ONLY", result.TerrainSource);
        Assert.False(result.DatumAlignmentVerified);
        Assert.DoesNotContain("secret-path", string.Join(" ", result.Warnings));
        Assert.Contains(result.Warnings, warning => warning.Contains("review"));
    }

    [Fact]
    public async Task Adapter_PreservesCancellation()
    {
        using var adapter = new ConfiguredTerrainHeightProvider(new TestTerrain());
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => adapter.GetHeightAsync(new TerrainLocation(-89, 25), cancellation.Token));
    }

    private sealed class TestTerrain : ITerrainService
    {
        public bool IsAvailable { get; init; } = true;
        public Task<TerrainHeightResult> GetHeightAsync(TerrainLocation location, CancellationToken cancellationToken = default) => GetElevationAsync(location, cancellationToken);
        public Task<TerrainHeightResult> GetElevationAsync(TerrainLocation location, CancellationToken cancellationToken = default) => Task.FromResult(
            new TerrainHeightResult(120, "SYNTHETIC TEST ONLY", "Moon (2015) Sphere R=1737400m", 80, true, ["secret-path"]));
        public Task<TerrainWindowResult> GetWindowAsync(TerrainWindowRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
