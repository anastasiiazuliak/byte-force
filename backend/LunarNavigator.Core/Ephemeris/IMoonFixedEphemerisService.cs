namespace LunarNavigator.Core.Ephemeris;

public interface IMoonFixedEphemerisService
{
    Task<EphemerisResponse> GetAsync(EphemerisRequest request, CancellationToken cancellationToken = default);
}
