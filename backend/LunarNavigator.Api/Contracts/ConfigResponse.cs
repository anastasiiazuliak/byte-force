namespace LunarNavigator.Api.Contracts;

/// <summary>Region, request limits and available features for frontend configuration.</summary>
public sealed record ConfigResponse(Region Region, AnalysisLimits Analysis, Features Features);
