using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Horizon;

/// <summary>
/// Computes 360-degree terrain obstruction profiles (horizon elevation angles)
/// accounting for lunar spherical curvature and polar azimuth conventions.
/// </summary>
public interface IHorizonService : IHorizonProfileProvider
{
    /// <summary>
    /// Computes or retrieves from cache a 360-degree horizon profile at the given lunar location.
    /// </summary>
    Task<HorizonProfileResult> GetProfileAsync(
        TerrainLocation location,
        HorizonOptions? options,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Interpolates the horizon elevation angle (degrees) for an arbitrary azimuth [0, 360),
    /// handling 359° ↔ 0° wrap-around seamlessly.
    /// </summary>
    double GetElevationAtAzimuth(HorizonProfileResult profile, double azimuthDeg);
}
