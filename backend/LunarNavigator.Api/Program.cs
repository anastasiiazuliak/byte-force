using LunarNavigator.Api.Contracts;
using LunarNavigator.Api.Foundation;
using LunarNavigator.Api.Infrastructure.Horizons;
using LunarNavigator.Api.Infrastructure.Map;
using LunarNavigator.Api.Infrastructure.Terrain;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Comparison;
using LunarNavigator.Core.Ephemeris;
using LunarNavigator.Core.Map;
using LunarNavigator.Core.Terrain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOptions<ApiSettings>().BindConfiguration("Api")
    .ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddOptions<EphemerisSettings>().BindConfiguration("Ephemeris")
    .ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddSingleton(services =>
{
    var settings = services.GetRequiredService<IOptions<ApiSettings>>().Value;
    return new AnalysisPolicy(settings.MinStepMinutes, settings.MaxStepMinutes, settings.MaxSamples);
});
builder.Services.AddHttpClient("Horizons", (services, client) =>
    client.Timeout = TimeSpan.FromSeconds(services.GetRequiredService<IOptions<EphemerisSettings>>().Value.HttpTimeoutSeconds));
builder.Services.AddSingleton<IEphemerisService, HorizonsEphemerisService>();
builder.Services.Configure<MapManifestSettings>(builder.Configuration.GetSection("MapManifest"));
builder.Services.AddSingleton<IMapMetadataService, FileMapMetadataService>();
builder.Services.AddSingleton<IFoundationConfig, FoundationConfig>();
builder.Services.AddSingleton<ILandingSiteCatalog, JsonLandingSiteCatalog>();
builder.Services.Configure<TerrainIntegrationSettings>(builder.Configuration.GetSection("Terrain"));
builder.Services.TryAddSingleton<ITerrainHeightProvider>(services =>
{
    var settings = services.GetRequiredService<IOptions<TerrainIntegrationSettings>>().Value;
    if (string.IsNullOrWhiteSpace(settings.DemPath)) return new UnavailableTerrainHeightProvider();
    var environment = services.GetRequiredService<IWebHostEnvironment>();
    var path = Path.GetFullPath(Path.Combine(environment.ContentRootPath, settings.DemPath));
    return new ConfiguredTerrainHeightProvider(TerrainFactory.CreateService(path));
});
builder.Services.TryAddSingleton<IHorizonProfileProvider, UnavailableHorizonProfileProvider>();
builder.Services.AddSingleton<IObserverAltitudeResolver, ObserverAltitudeResolver>();
builder.Services.AddSingleton<IAnalysisService, AnalysisService>();
builder.Services.AddSingleton<IComparisonService, ComparisonService>();
builder.Services.TryAddSingleton<IMoonFixedProvider, UnavailableMoonFixedProvider>();
builder.Services.AddSingleton<IMoonFixedEphemerisService, MoonFixedEphemerisService>();
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new UtcDateTimeOffsetConverter())).ConfigureApiBehaviorOptions(options =>
{
    options.InvalidModelStateResponseFactory = _ => new BadRequestObjectResult(
        new ErrorResponse(new ErrorDetail("VALIDATION_ERROR", "The request is invalid.")));
});
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    var origins = builder.Configuration.GetSection("Api:AllowedOrigins").Get<string[]>() ?? [];
    if (origins.Length > 0)
        policy.WithOrigins(origins).WithMethods("GET", "POST").AllowAnyHeader();
}));

var app = builder.Build();
app.Use(async (context, next) =>
{
    var originalToken = context.RequestAborted;
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(originalToken);
    timeout.CancelAfter(TimeSpan.FromSeconds(context.RequestServices.GetRequiredService<IOptions<ApiSettings>>().Value.RequestTimeoutSeconds));
    context.RequestAborted = timeout.Token;
    try
    {
        await next(context);
    }
    catch (OperationCanceledException) when (originalToken.IsCancellationRequested)
    {
        context.Abort();
    }
    catch (Exception exception) when (!context.Response.HasStarted)
    {
        var (status, code, message) = exception switch
        {
            NavigationException error => (error.StatusCode, error.Code, error.Message),
            OperationCanceledException when (timeout.IsCancellationRequested) => (504, "ANALYSIS_TIMEOUT", "The request exceeded the configured time limit."),
            CatalogUnavailableException => (503, "INTERNAL_ERROR", "The landing-site catalog is unavailable."),
            BadHttpRequestException => (400, "VALIDATION_ERROR", "The request is invalid."),
            _ => (500, "INTERNAL_ERROR", "An unexpected server error occurred.")
        };
        app.Logger.LogWarning("Request failed with {ErrorCode} ({FailureType}).", code, exception.GetType().Name);
        context.Response.Clear();
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ErrorResponse(new ErrorDetail(code, message)), originalToken);
    }
    finally { context.RequestAborted = originalToken; }
});
app.UseStatusCodePages(async statusContext =>
{
    var response = statusContext.HttpContext.Response;
    var (code, message) = response.StatusCode switch
    {
        404 => ("VALIDATION_ERROR", "The requested endpoint was not found."),
        405 => ("VALIDATION_ERROR", "The HTTP method is not supported."),
        _ => ("INTERNAL_ERROR", "The request could not be completed.")
    };
    await response.WriteAsJsonAsync(new ErrorResponse(new ErrorDetail(code, message)),
        statusContext.HttpContext.RequestAborted);
});
app.UseRouting();
app.UseCors();
app.MapControllers();
app.Run();

public partial class Program;
