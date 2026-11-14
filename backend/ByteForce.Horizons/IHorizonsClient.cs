using ByteForce.Models;

namespace ByteForce.Horizons;

public interface IHorizonsClient
{
    /// <summary>Gets both positions at one instant. Time must have millisecond precision or coarser.</summary>
    Task<LunarObservation> GetObservationAsync(
        LunarObserver observer,
        DateTimeOffset time,
        CancellationToken cancellationToken = default);
}
