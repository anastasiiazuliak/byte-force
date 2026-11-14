using System.Text.Json;
using LunarNavigator.Api.Contracts;
using Microsoft.Extensions.Options;

namespace LunarNavigator.Api.Foundation;

/// <summary>Reads and validates local catalog entries without accessing external services.</summary>
public sealed class JsonLandingSiteCatalog(
    IWebHostEnvironment environment, IOptions<ApiSettings> settings,
    ILogger<JsonLandingSiteCatalog> logger) : ILandingSiteCatalog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IWebHostEnvironment _environment = environment;
    private readonly IOptions<ApiSettings> _settings = settings;
    private readonly ILogger<JsonLandingSiteCatalog> _logger = logger;

    public async Task<IReadOnlyList<LandingSite>> GetAsync(CancellationToken cancellationToken = default)
    {
        LandingSitesResponse catalog;
        try
        {
            var path = Path.Combine(_environment.ContentRootPath, _settings.Value.CatalogPath);
            await using var stream = File.OpenRead(path);
            catalog = await JsonSerializer.DeserializeAsync<LandingSitesResponse>(stream, JsonOptions, cancellationToken)
                ?? throw new JsonException();
            if (catalog.Sites is null)
                throw new JsonException();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            // Avoid exposing local paths, catalog contents or exception messages.
            _logger.LogWarning("Landing-site catalog could not be read ({FailureType}).", exception.GetType().Name);
            throw new CatalogUnavailableException();
        }

        // Reject every occurrence of a duplicate ID, rather than choosing an arbitrary winner.
        var duplicateIds = catalog.Sites.Where(site => site is not null && site.Id is not null)
            .GroupBy(site => site.Id, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var sites = catalog.Sites.Where(site => IsValid(site) && !duplicateIds.Contains(site.Id)).ToArray();
        if (sites.Length != catalog.Sites.Count)
            _logger.LogWarning("Rejected {RejectedCount} invalid or duplicate landing-site entries.", catalog.Sites.Count - sites.Length);
        return sites;
    }

    /// <summary>Checks coordinate bounds, required fields and source or DEMO labelling.</summary>
    public static bool IsValid(LandingSite? site)
    {
        if (site is null || string.IsNullOrWhiteSpace(site.Id) || string.IsNullOrWhiteSpace(site.Name) ||
            string.IsNullOrWhiteSpace(site.Description) ||
            !double.IsFinite(site.Latitude) || site.Latitude is < -90 or > -80 ||
            !double.IsFinite(site.Longitude) || site.Longitude is < -180 or > 180)
            return false;

        // Only explicitly labelled demo entries may omit a source. No network calls on startup/request.
        if (site.SourceUrl is null)
            return site.Id.StartsWith("demo-", StringComparison.OrdinalIgnoreCase) &&
                site.Name.StartsWith("DEMO ", StringComparison.Ordinal) &&
                site.Description.Contains("DEMO", StringComparison.Ordinal);
        return Uri.TryCreate(site.SourceUrl, UriKind.Absolute, out var source) &&
            source.Scheme == "https" && !string.IsNullOrEmpty(source.Host) && string.IsNullOrEmpty(source.UserInfo);
    }
}
