namespace LunarNavigator.Api.Infrastructure.Map;

public sealed class MapManifestSettings
{
    public string ManifestPath { get; set; } = "";
    public string AssetRootPath { get; set; } = "";
    public string? AssetBaseUrl { get; set; }
}
