using LunarNavigator.Api.Contracts;
using LunarNavigator.Api.Foundation;
using Microsoft.AspNetCore.Mvc;

namespace LunarNavigator.Api.Controllers;

/// <summary>Exposes server status, frontend configuration and the local site catalog.</summary>
[ApiController]
[Route("api/v1")]
public sealed class FoundationController(IFoundationConfig config, ILandingSiteCatalog catalog) : ControllerBase
{
    private readonly IFoundationConfig _config = config;
    private readonly ILandingSiteCatalog _catalog = catalog;

    [HttpGet("health")]
    public ActionResult<HealthResponse> Health() => new HealthResponse("ok",
        typeof(Program).Assembly.GetName().Version?.ToString(3) ?? "1.0.0");

    [HttpGet("config")]
    public ActionResult<ConfigResponse> Config() => _config.Get();

    [HttpGet("landing-sites")]
    public async Task<ActionResult<LandingSitesResponse>> LandingSites(CancellationToken cancellationToken) =>
        new LandingSitesResponse(await _catalog.GetAsync(cancellationToken));
}
