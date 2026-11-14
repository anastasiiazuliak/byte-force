using LunarNavigator.Core.Ephemeris;
using Microsoft.AspNetCore.Mvc;

namespace LunarNavigator.Api.Controllers;

[ApiController]
[Route("api/v1/ephemeris")]
public sealed class EphemerisController(IMoonFixedEphemerisService ephemeris) : ControllerBase
{
    private readonly IMoonFixedEphemerisService _ephemeris = ephemeris;

    [HttpPost]
    public async Task<ActionResult<EphemerisResponse>> GetAsync(EphemerisRequest request, CancellationToken cancellationToken) =>
        await _ephemeris.GetAsync(request, cancellationToken);
}
