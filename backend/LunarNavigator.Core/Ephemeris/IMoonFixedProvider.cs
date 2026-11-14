using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Ephemeris;

/// <summary>Integration boundary for independently validated Moon-fixed vectors, never local ENU angles.</summary>
public interface IMoonFixedProvider
{
    bool IsVerified { get; }
    Task<MoonFixedProviderResult> GetAsync(AnalysisPeriod period, CancellationToken cancellationToken = default);
}
