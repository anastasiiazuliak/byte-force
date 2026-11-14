using LunarNavigator.Core.Comparison;
using Microsoft.AspNetCore.Mvc;

namespace LunarNavigator.Api.Controllers;

[ApiController]
[Route("api/v1/compare")]
public sealed class ComparisonController(IComparisonService comparison) : ControllerBase
{
    private readonly IComparisonService _comparison = comparison;

    [HttpPost]
    public async Task<ActionResult<CompareResponse>> CompareAsync(CompareRequest request, CancellationToken cancellationToken) =>
        await _comparison.CompareAsync(request, cancellationToken);
}
