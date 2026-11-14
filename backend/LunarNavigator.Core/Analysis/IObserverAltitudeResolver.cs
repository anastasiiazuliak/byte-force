namespace LunarNavigator.Core.Analysis;

public interface IObserverAltitudeResolver
{
    ObserverAltitude Resolve(TerrainHeightResult height);
}
