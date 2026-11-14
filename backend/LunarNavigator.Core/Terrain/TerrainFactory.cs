using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Horizon;

namespace LunarNavigator.Core.Terrain;

/// <summary>Factory helpers for terrain, height and horizon services.</summary>
public static class TerrainFactory
{
    /// <summary>
    /// Creates a new instance of <see cref="ITerrainService"/> with optional explicit path.
    /// </summary>
    public static ITerrainService CreateService(string? demFilePath = null)
    {
        return new LolaTerrainService(demFilePath);
    }

    /// <summary>
    /// Creates a new instance of <see cref="ITerrainHeightProvider"/> for analysis modules.
    /// </summary>
    public static ITerrainHeightProvider CreateHeightProvider(string? demFilePath = null)
    {
        return new LolaTerrainService(demFilePath);
    }

    /// <summary>
    /// Creates a new instance of <see cref="IHorizonService"/> backed by the given <see cref="ITerrainService"/>.
    /// </summary>
    public static IHorizonService CreateHorizonService(ITerrainService terrainService, HorizonOptions? options = null)
    {
        return new LolaHorizonService(terrainService, options);
    }
}
