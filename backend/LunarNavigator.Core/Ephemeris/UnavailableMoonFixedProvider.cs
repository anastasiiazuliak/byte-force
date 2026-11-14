using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Ephemeris;

public sealed class UnavailableMoonFixedProvider : IMoonFixedProvider
{
    public bool IsVerified => false;

    public Task<MoonFixedProviderResult> GetAsync(AnalysisPeriod period, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        throw new NavigationException(503, "EPHEMERIS_UNAVAILABLE", "A verified Moon-fixed frame transformation is not configured.");
    }
}
