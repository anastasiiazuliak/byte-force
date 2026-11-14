using LunarNavigator.Core.Analysis;
<<<<<<< Updated upstream
using LunarNavigator.Core.Horizon;
=======
<<<<<<< HEAD
using LunarNavigator.Core.Horizon;
=======
>>>>>>> 69b0eae (moona)
>>>>>>> Stashed changes

namespace LunarNavigator.Core.Terrain;

/// <summary>
<<<<<<< Updated upstream
/// Factory helpers for instantiating terrain, elevation and horizon services without DI dependencies.
=======
<<<<<<< HEAD
/// Factory helpers for instantiating terrain, elevation and horizon services without DI dependencies.
=======
/// Factory helpers for instantiating terrain and elevation services without DI dependencies.
>>>>>>> 69b0eae (moona)
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
<<<<<<< HEAD
>>>>>>> Stashed changes

    /// <summary>
    /// Creates a new instance of <see cref="IHorizonService"/> backed by the given <see cref="ITerrainService"/>.
    /// </summary>
    public static IHorizonService CreateHorizonService(ITerrainService terrainService, HorizonOptions? options = null)
    {
        return new LolaHorizonService(terrainService, options);
    }
<<<<<<< Updated upstream
=======
=======
>>>>>>> 69b0eae (moona)
>>>>>>> Stashed changes
}
