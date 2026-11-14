using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Map;

public sealed record SceneTransform(
    [property: JsonRequired] double OriginEastingM,
    [property: JsonRequired] double OriginNorthingM,
    [property: JsonRequired] double VerticalOriginM,
    [property: JsonRequired] bool Validated);
