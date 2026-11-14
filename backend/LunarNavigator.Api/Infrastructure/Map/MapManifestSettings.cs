namespace LunarNavigator.Api.Infrastructure.Map;

public sealed class MapManifestSettings
{
    public string ManifestPath { get; set; } = "";
    public string AssetRootPath { get; set; } = "";
    // Deployment attestation after reviewing the actual dataset and generated assets, not schema validation.
    public bool MetadataReviewConfirmed { get; set; }
    public string? AssetBaseUrl { get; set; }
}
