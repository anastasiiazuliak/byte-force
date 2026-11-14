using System.ComponentModel.DataAnnotations;

namespace LunarNavigator.Api.Foundation;

/// <summary>Local catalog, CORS and analysis limits loaded from configuration.</summary>
public sealed class ApiSettings : IValidatableObject
{
    [Range(1, 1440)]
    public int MinStepMinutes { get; set; } = 10;

    [Range(1, 1440)]
    public int MaxStepMinutes { get; set; } = 1440;

    [Range(2, 100000)]
    public int MaxSamples { get; set; } = 2000;

    [Range(2, 2)]
    public int MaxScenarios { get; set; } = 2;

    [Required]
    public string CatalogPath { get; set; } = "Data/landing-sites.json";

    public string[] AllowedOrigins { get; set; } = [];

    [Range(1, 600)]
    public int RequestTimeoutSeconds { get; set; } = 120;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (MaxStepMinutes < MinStepMinutes)
            yield return new ValidationResult("MaxStepMinutes must be >= MinStepMinutes.");
        if (AllowedOrigins is null || AllowedOrigins.Any(origin =>
                !Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
                uri.Scheme is not ("http" or "https") || !string.IsNullOrEmpty(uri.UserInfo) ||
                origin != uri.GetLeftPart(UriPartial.Authority)))
            yield return new ValidationResult("AllowedOrigins must contain exact HTTP(S) origins without paths or wildcards.");
    }
}
