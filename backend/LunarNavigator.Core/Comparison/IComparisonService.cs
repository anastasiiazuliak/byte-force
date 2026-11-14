namespace LunarNavigator.Core.Comparison;

public interface IComparisonService
{
    Task<CompareResponse> CompareAsync(CompareRequest request, CancellationToken cancellationToken = default);
}
