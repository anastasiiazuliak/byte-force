using LunarNavigator.Core.Analysis;
using LunarNavigator.Models;

namespace LunarNavigator.Core.Ephemeris;

public interface IEphemerisService
{
    /// <summary>Gets actual Horizons positions at each sample, using altitude above its lunar reference sphere in km.</summary>
    Task<IReadOnlyList<LunarObservation>> GetAsync(
        Coordinates location, double altitudeKilometers, AnalysisPeriod period, CancellationToken cancellationToken = default);
}
