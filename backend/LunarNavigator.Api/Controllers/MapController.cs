using LunarNavigator.Core.Map;
using Microsoft.AspNetCore.Mvc;

namespace LunarNavigator.Api.Controllers;

[ApiController]
[Route("api/v1/map")]
public sealed class MapController(IMapMetadataService metadata) : ControllerBase
{
    private readonly IMapMetadataService _metadata = metadata;

    [HttpGet("metadata")]
    public async Task<ActionResult<MapMetadata>> GetMetadataAsync(CancellationToken cancellationToken) =>
        await _metadata.GetAsync(cancellationToken);
}
