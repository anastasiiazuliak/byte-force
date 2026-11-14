using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Terrain;

/// <summary>
/// Factory helpers for instantiating terrain and elevation services without DI dependencies.
/// </summary>
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
}
