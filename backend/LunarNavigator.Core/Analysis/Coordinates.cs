using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Analysis;

public sealed record Coordinates(
    [property: JsonRequired] double Latitude,
    [property: JsonRequired] double Longitude);
