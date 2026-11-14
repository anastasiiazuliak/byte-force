namespace LunarNavigator.Core.Analysis;

public sealed record AnalysisIntervals(
    IReadOnlyList<VisibilityInterval> SunVisible, IReadOnlyList<VisibilityInterval> EarthVisible);
