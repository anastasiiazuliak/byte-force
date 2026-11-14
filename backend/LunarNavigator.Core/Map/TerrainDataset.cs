using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Map;

public sealed record TerrainDataset(
    [property: JsonRequired] string Id,
    [property: JsonRequired] double SourceResolutionMeters,
    [property: JsonRequired] string? VerticalReference,
    [property: JsonRequired] bool MetadataVerified);
