namespace LunarNavigator.Core.Analysis;

/// <summary>A half-open interval [StartUtc, EndUtc).</summary>
public sealed record VisibilityInterval(DateTimeOffset StartUtc, DateTimeOffset EndUtc);
