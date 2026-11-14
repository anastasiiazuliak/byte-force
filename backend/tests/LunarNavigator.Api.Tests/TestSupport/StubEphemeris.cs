using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Ephemeris;
using LunarNavigator.Models;

namespace LunarNavigator.Api.Tests.TestSupport;

/// <summary>Synthetic test data only. Never registered in the production application.</summary>
internal sealed class StubEphemeris : IEphemerisService
{
    public int Calls { get; private set; }
    public double LastAltitudeKm { get; private set; }
    public Func<Coordinates, DateTimeOffset, (double Sun, double Earth)> Positions { get; init; } = (_, _) => (1, -1);
    public bool OmitTerminalSample { get; init; }
    public bool Fail { get; init; }

    public Task<IReadOnlyList<LunarObservation>> GetAsync(Coordinates location, double altitudeKilometers,
        AnalysisPeriod period, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Calls++;
        LastAltitudeKm = altitudeKilometers;
        if (Fail) throw new NavigationException(503, "EPHEMERIS_UNAVAILABLE", "Synthetic test failure.");
        var times = RequestValidation.SampleTimes(period);
        return Task.FromResult<IReadOnlyList<LunarObservation>>(times.Take(times.Count - (OmitTerminalSample ? 1 : 0))
            .Select(time => new LunarObservation(time, Positions(location, time).Sun, 0, Positions(location, time).Earth, 180)).ToArray());
    }
}
