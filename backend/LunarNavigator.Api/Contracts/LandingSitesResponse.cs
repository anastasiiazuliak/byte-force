namespace LunarNavigator.Api.Contracts;

/// <summary>Catalog entries that passed validation.</summary>
public sealed record LandingSitesResponse(IReadOnlyList<LandingSite> Sites);
