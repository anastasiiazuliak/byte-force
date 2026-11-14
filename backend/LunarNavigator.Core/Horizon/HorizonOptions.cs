namespace LunarNavigator.Core.Horizon;

/// <summary>
/// Configuration parameters for 360-degree lunar terrain horizon computation (DATA-02).
/// </summary>
public sealed record HorizonOptions
{
    /// <summary>Angular spacing between azimuth rays in degrees (must divide 360 cleanly or be > 0).</summary>
    public double AzimuthStepDeg { get; init; } = 1.0;

    /// <summary>Maximum ray-marching range in projected meters (far-field horizon limit).</summary>
    public double MaxRangeMeters { get; init; } = 20_000.0;

    /// <summary>Step size along each azimuth ray in meters (defaults to DEM pixel scale, e.g. 80 m).</summary>
    public double RayStepMeters { get; init; } = 80.0;

    /// <summary>Observer antenna/camera height offset above the DEM surface in meters.</summary>
    public double ObserverHeightOffsetMeters { get; init; } = 2.0;

    /// <summary>Maximum number of cached horizon profiles in memory.</summary>
    public int MaxCachedProfiles { get; init; } = 128;

    /// <summary>Optional soft compute budget in milliseconds; exceeding it yields partial status with a warning.</summary>
    public int MaxComputeMilliseconds { get; init; } = 15_000;

    public static HorizonOptions Default { get; } = new();
}
