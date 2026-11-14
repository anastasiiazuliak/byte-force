namespace LunarNavigator.Core.Analysis;

public sealed record AnalysisSummary(
    double? SunVisibleHours, double? EarthVisibleHours, double? BothVisibleHours,
    double? SunVisiblePercent, double? EarthVisiblePercent);
