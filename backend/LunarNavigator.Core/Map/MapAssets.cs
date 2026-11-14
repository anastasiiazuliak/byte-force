using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Map;

public sealed record MapAssets(
    [property: JsonRequired] string? TerrainTemplate,
    [property: JsonRequired] string? SurfaceTemplate,
    [property: JsonRequired] string? HillshadeTemplate,
    [property: JsonRequired] string? DemoMeshUrl);
