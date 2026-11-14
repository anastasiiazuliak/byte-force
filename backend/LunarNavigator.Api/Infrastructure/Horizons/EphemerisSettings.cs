using System.ComponentModel.DataAnnotations;

namespace LunarNavigator.Api.Infrastructure.Horizons;

public sealed class EphemerisSettings
{
    [Range(1, 120)]
    public int HttpTimeoutSeconds { get; set; } = 30;

    [Range(1, 3)]
    public int MaxAttempts { get; set; } = 2;

    [Range(1, 5000)]
    public int RetryDelayMilliseconds { get; set; } = 250;

    [Range(1, 86400)]
    public int CacheSeconds { get; set; } = 3600;
}
