using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Map;

public sealed record MapMetadata(
    [property: JsonRequired] string RegionId,
    [property: JsonRequired] MapProjection Projection,
    [property: JsonRequired] MapRender Render,
    [property: JsonRequired] MapAssets Assets,
    [property: JsonRequired] TerrainDataset TerrainDataset);
