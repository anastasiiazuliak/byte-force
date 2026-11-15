using LunarNavigator.Core.Analysis;

namespace LunarNavigator.Core.Comparison;

public sealed class ComparisonService(IAnalysisService analysis, AnalysisPolicy policy) : IComparisonService
{
    private readonly IAnalysisService _analysis = analysis;
    private readonly AnalysisPolicy _policy = policy;

    public async Task<CompareResponse> CompareAsync(CompareRequest request, CancellationToken cancellationToken = default)
    {
        if (request?.Scenarios is not { Count: 2 } || request.Scenarios.Any(scenario => scenario is null) ||
            !request.Scenarios.Select(scenario => scenario.Id).Order(StringComparer.Ordinal).SequenceEqual(["A", "B"]))
            throw RequestValidation.Invalid("Provide exactly one scenario A and one scenario B.");
        var requests = request.Scenarios.OrderBy(scenario => scenario.Id, StringComparer.Ordinal)
            .Select(scenario => new AnalysisRequest(scenario.Location, scenario.Period, scenario.Options ?? new AnalysisOptions())).ToArray();
        foreach (var scenario in requests) RequestValidation.Validate(scenario, _policy);
        // Reuse identical analyses only inside this comparison. No stale cross-request analysis cache.
        AnalysisResponse responseA;
        AnalysisResponse responseB;
        if (requests[0].Equals(requests[1]))
        {
            cancellationToken.ThrowIfCancellationRequested();
            using var scenarioCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            responseA = await _analysis.AnalyzeAsync(requests[0], scenarioCancellation.Token);
            responseB = responseA;
        }
        else
        {
            cancellationToken.ThrowIfCancellationRequested();
            using var cancelA = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            using var cancelB = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var taskA = _analysis.AnalyzeAsync(requests[0], cancelA.Token);
            var taskB = _analysis.AnalyzeAsync(requests[1], cancelB.Token);
            await Task.WhenAll(taskA, taskB);
            responseA = await taskA;
            responseB = await taskB;
        }
        var results = new List<CompareScenarioResponse>(2)
        {
            new("A", responseA),
            new("B", responseB)
        };
        if (requests[0].Period.EndUtc - requests[0].Period.StartUtc != requests[1].Period.EndUtc - requests[1].Period.StartUtc)
        {
            for (var index = 0; index < results.Count; index++)
            {
                var result = results[index];
                results[index] = result with { Analysis = result.Analysis with { Quality = result.Analysis.Quality with
                {
                    Warnings = result.Analysis.Quality.Warnings.Append(
                        "Scenario durations differ; use the returned periods and visibility percentages when interpreting B minus A hours.").ToArray()
                } } };
            }
        }
        var a = results[0].Analysis.Summary;
        var b = results[1].Analysis.Summary;
        return new CompareResponse(results, new ComparisonDifferences(
            b.SunVisibleHours - a.SunVisibleHours, b.EarthVisibleHours - a.EarthVisibleHours, b.BothVisibleHours - a.BothVisibleHours));
    }
}
