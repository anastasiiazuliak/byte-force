using LunarNavigator.Api.Contracts;
using LunarNavigator.Core.Ephemeris;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Api.Infrastructure.Terrain;
using Microsoft.Extensions.Options;

namespace LunarNavigator.Api.Foundation;

/// <summary>Provides frontend configuration without querying scientific services.</summary>
public sealed class FoundationConfig(IOptions<ApiSettings> settings, IMoonFixedProvider moonFixed, ITerrainHeightProvider? heights = null) : IFoundationConfig
{
    private readonly IOptions<ApiSettings> _settings = settings;
    private readonly IMoonFixedProvider _moonFixed = moonFixed;

    public ConfigResponse Get() => new(
        new Region("lunar-south-pole", "Lunar South Pole", -90, -80, -180, 180),
        new AnalysisLimits(_settings.Value.MinStepMinutes, _settings.Value.MaxStepMinutes,
            _settings.Value.MaxSamples, _settings.Value.MaxScenarios),
        // Enable only when implementations are actually registered and integrated.
        new Features(false, true, heights is ConfiguredTerrainHeightProvider { HasReviewedDatumAlignment: true }, _moonFixed.IsVerified));
}
