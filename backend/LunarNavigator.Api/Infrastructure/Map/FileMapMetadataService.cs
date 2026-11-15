using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Map;
using Microsoft.Extensions.Options;

namespace LunarNavigator.Api.Infrastructure.Map;

/// <summary>Validates a data-lane manifest and checks local deployment assets without generating or serving them.</summary>
public sealed class FileMapMetadataService(
    IWebHostEnvironment environment, IOptions<MapManifestSettings> settings) : IMapMetadataService
{
    private readonly string _contentRoot = environment.ContentRootPath;
    private readonly MapManifestSettings _settings = settings.Value;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<MapMetadata> GetAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_settings.ManifestPath))
            throw Unavailable();
        try
        {
            await using var stream = File.OpenRead(Path.Combine(_contentRoot, _settings.ManifestPath));
            var manifest = await JsonSerializer.DeserializeAsync<MapManifest>(stream, JsonOptions, cancellationToken);
            if (manifest is null || manifest.SchemaVersion != 1 || manifest.Metadata is null)
                throw Unavailable();
            if (manifest.Metadata.TerrainDataset is null) throw Unavailable();
            if (manifest.Metadata.TerrainDataset.MetadataVerified && !_settings.MetadataReviewConfirmed)
                throw Unavailable();
            ValidateMetadata(manifest.Metadata);
            var metadata = manifest.Metadata;
            var assets = metadata.Assets;
            if (assets.DemoMeshUrl is not null && !assets.DemoMeshUrl.EndsWith(".glb", StringComparison.OrdinalIgnoreCase) ||
                assets.TerrainTemplate is not null && !assets.TerrainTemplate.EndsWith(".glb", StringComparison.OrdinalIgnoreCase) ||
                new[] { assets.SurfaceTemplate, assets.HillshadeTemplate }.Any(template =>
                    template is not null && !template.EndsWith(".webp", StringComparison.OrdinalIgnoreCase)))
                throw Unavailable();
            var required = manifest.RequiredAssets ?? [];
            foreach (var path in required) CheckAsset(path);
            if (assets.DemoMeshUrl is not null) CheckAsset(assets.DemoMeshUrl);
            foreach (var template in new[] { assets.TerrainTemplate, assets.SurfaceTemplate, assets.HillshadeTemplate })
            {
                if (template is null) continue;
                var relativeTemplate = AssetRelativePath(template);
                if (!relativeTemplate.Contains("{z}") || !relativeTemplate.Contains("{x}") || !relativeTemplate.Contains("{y}"))
                    throw Unavailable();
                var pattern = "^" + Regex.Escape(relativeTemplate).Replace("\\{z}", "(?<z>[0-9]+)")
                    .Replace("\\{x}", "(?<x>[0-9]+)").Replace("\\{y}", "(?<y>[0-9]+)") + "$";
                if (!required.Any(path =>
                    {
                        var match = Regex.Match(AssetRelativePath(path), pattern, RegexOptions.CultureInvariant);
                        return match.Success && int.TryParse(match.Groups["z"].Value, out var zoom) &&
                            zoom >= metadata.Render.MinZoom && zoom <= metadata.Render.MaxZoom &&
                            int.TryParse(match.Groups["x"].Value, out _) && int.TryParse(match.Groups["y"].Value, out _);
                    }))
                    throw Unavailable();
            }
            if (metadata.TerrainDataset.MetadataVerified && assets.TerrainTemplate is null && assets.DemoMeshUrl is null)
                throw Unavailable();
            return metadata;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException or ArgumentException)
        {
            throw Unavailable();
        }
    }

    public static void ValidateMetadata(MapMetadata metadata)
    {
        if (metadata.RegionId != "lunar-south-pole" || metadata.Projection is null || metadata.Render is null ||
            metadata.Assets is null || metadata.TerrainDataset is null)
            throw Unavailable();
        var projection = metadata.Projection;
        var render = metadata.Render;
        var dataset = metadata.TerrainDataset;
        if (projection.Name != "south-polar-stereographic" || projection.LinearUnit != "m" ||
            render.Type != "projected-terrain" || render.TileSize <= 0 || render.MinZoom < 0 ||
            render.MaxZoom < render.MinZoom || render.MaxZoom > 24 || string.IsNullOrWhiteSpace(dataset.Id) ||
            !double.IsFinite(dataset.SourceResolutionMeters) || dataset.SourceResolutionMeters <= 0)
            throw Unavailable();
        if (render.BoundsMeters is { } bounds &&
            (!double.IsFinite(bounds.MinX) || !double.IsFinite(bounds.MinY) || !double.IsFinite(bounds.MaxX) ||
             !double.IsFinite(bounds.MaxY) || bounds.MinX >= bounds.MaxX || bounds.MinY >= bounds.MaxY))
            throw Unavailable();
        if (render.SceneTransform is { } scene &&
            (!double.IsFinite(scene.OriginEastingM) || !double.IsFinite(scene.OriginNorthingM) || !double.IsFinite(scene.VerticalOriginM)))
            throw Unavailable();
        if (projection.ProjDefinition?.Contains('<') == true || dataset.VerticalReference?.Contains('<') == true)
            throw Unavailable();
        if (dataset.MetadataVerified)
        {
            if (projection.SourceFrame != "MOON_ME" || string.IsNullOrWhiteSpace(projection.ProjDefinition) ||
                string.IsNullOrWhiteSpace(dataset.VerticalReference) || render.SceneTransform?.Validated != true || render.BoundsMeters is null)
                throw Unavailable();
            var parameters = projection.ProjDefinition.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(value => value.StartsWith('+')).Select(value => value[1..].Split('=', 2))
                .Where(pair => pair.Length == 2).ToDictionary(pair => pair[0], pair => pair[1]);
            if (!parameters.TryGetValue("proj", out var name) || name != "stere" ||
                !parameters.TryGetValue("lat_0", out var latitude) || !double.TryParse(latitude, CultureInfo.InvariantCulture, out var pole) || pole != -90 ||
                !parameters.TryGetValue("units", out var units) || units != "m")
                throw Unavailable();
            var radius = parameters.GetValueOrDefault("R") ?? parameters.GetValueOrDefault("a");
            if (!double.TryParse(radius, CultureInfo.InvariantCulture, out var radiusM) || radiusM is < 1700000 or > 1800000 ||
                parameters.ContainsKey("datum") || parameters.ContainsKey("ellps"))
                throw Unavailable();
            if (parameters.TryGetValue("b", out var minor) &&
                (!double.TryParse(minor, CultureInfo.InvariantCulture, out var b) || Math.Abs(b - radiusM) > 0.001))
                throw Unavailable();
        }
        else if (render.SceneTransform?.Validated == true || metadata.Assets.TerrainTemplate is not null ||
                 metadata.Assets.SurfaceTemplate is not null || metadata.Assets.HillshadeTemplate is not null)
            throw Unavailable();
    }

    private void CheckAsset(string url)
    {
        if (string.IsNullOrWhiteSpace(_settings.AssetRootPath)) throw Unavailable();
        var relative = AssetRelativePath(url);
        var root = Path.GetFullPath(Path.Combine(_contentRoot, _settings.AssetRootPath));
        var path = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !File.Exists(path))
            throw Unavailable();
    }

    private string AssetRelativePath(string url)
    {
        if (string.IsNullOrWhiteSpace(url) || url.StartsWith("//") || url.IndexOfAny(['\\', '%', '?', '#', '<', '>']) >= 0)
            throw Unavailable();
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri) && !url.StartsWith('/'))
        {
            if (uri.Scheme != "https" || string.IsNullOrWhiteSpace(_settings.AssetBaseUrl) ||
                !Uri.TryCreate(_settings.AssetBaseUrl.TrimEnd('/') + "/", UriKind.Absolute, out var baseUri) ||
                !baseUri.IsBaseOf(uri)) throw Unavailable();
            url = baseUri.MakeRelativeUri(uri).ToString();
        }
        var relative = url.TrimStart('/');
        if (relative.Split('/').Any(part => part is "" or "." or "..") || relative.Contains(':'))
            throw Unavailable();
        return relative;
    }

    private static NavigationException Unavailable() => new(503, "TERRAIN_DATA_UNAVAILABLE",
        "A valid map manifest and its deployment assets are not available.");
}
