namespace LunarNavigator.Core.Analysis;

public sealed record AnalysisResponse(
    string Status, AnalysisLocation Location, AnalysisPeriod Period, AnalysisSummary Summary,
    IReadOnlyList<AnalysisSample> Samples, AnalysisIntervals Intervals, HorizonResponse? Horizon, AnalysisQuality Quality);
