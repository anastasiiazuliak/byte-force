using System.Text.Json.Serialization;

namespace LunarNavigator.Api.Contracts;

/// <summary>A catalog location, with a source URL or an explicit DEMO label.</summary>
public sealed record LandingSite(
    [property: JsonRequired] string Id,
    [property: JsonRequired] string Name,
    [property: JsonRequired] string Description,
    [property: JsonRequired] double Latitude,
    [property: JsonRequired] double Longitude,
    [property: JsonRequired] string? SourceUrl);
