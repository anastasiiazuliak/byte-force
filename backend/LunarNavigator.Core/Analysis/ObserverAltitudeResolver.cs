namespace LunarNavigator.Core.Analysis;

/// <summary>Converts only an explicitly aligned datum. Other datasets need their own reviewed adapter.</summary>
public sealed class ObserverAltitudeResolver : IObserverAltitudeResolver
{
    public const string HorizonsDatum = "HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M";

    public ObserverAltitude Resolve(TerrainHeightResult height)
    {
        if (height.DatumAlignmentVerified && height.VerticalReference == HorizonsDatum &&
            height.ElevationM is { } elevation && double.IsFinite(elevation) && elevation > -1737400)
            return new ObserverAltitude(elevation / 1000, true, null);
        return new ObserverAltitude(0, false,
            "Observer altitude is approximated on the Horizons 1737.4 km reference sphere; terrain datum alignment is unverified.");
    }
}
