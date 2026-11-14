namespace LunarNavigator.Core.Analysis;

public interface IAnalysisService
{
    Task<AnalysisResponse> AnalyzeAsync(AnalysisRequest request, CancellationToken cancellationToken = default);
}
