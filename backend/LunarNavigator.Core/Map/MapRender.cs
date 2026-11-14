using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Map;

public sealed record MapRender(
    [property: JsonRequired] string Type,
    [property: JsonRequired] int TileSize,
    [property: JsonRequired] int MinZoom,
    [property: JsonRequired] int MaxZoom,
    [property: JsonRequired] ProjectedBounds? BoundsMeters,
    [property: JsonRequired] SceneTransform? SceneTransform);
