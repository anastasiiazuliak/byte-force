using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Map;

public sealed record ProjectedBounds(
    [property: JsonRequired] double MinX,
    [property: JsonRequired] double MinY,
    [property: JsonRequired] double MaxX,
    [property: JsonRequired] double MaxY);
