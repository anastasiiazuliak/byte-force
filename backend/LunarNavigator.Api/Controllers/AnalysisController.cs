using LunarNavigator.Core.Analysis;
using Microsoft.AspNetCore.Mvc;

namespace LunarNavigator.Api.Controllers;

[ApiController]
[Route("api/v1/analyze")]
public sealed class AnalysisController(IAnalysisService analysis) : ControllerBase
{
    private readonly IAnalysisService _analysis = analysis;

    [HttpPost]
    public async Task<ActionResult<AnalysisResponse>> AnalyzeAsync(AnalysisRequest request, CancellationToken cancellationToken) =>
        await _analysis.AnalyzeAsync(request, cancellationToken);
}
