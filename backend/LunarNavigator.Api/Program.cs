using LunarNavigator.Api.Contracts;
using LunarNavigator.Api.Foundation;
using LunarNavigator.Core.Analysis;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOptions<ApiSettings>().BindConfiguration("Api")
    .ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddSingleton<IFoundationConfig, FoundationConfig>();
builder.Services.AddSingleton<ILandingSiteCatalog, JsonLandingSiteCatalog>();
builder.Services.TryAddSingleton<ITerrainHeightProvider, UnavailableTerrainHeightProvider>();
builder.Services.TryAddSingleton<IHorizonProfileProvider, UnavailableHorizonProfileProvider>();
builder.Services.AddControllers().ConfigureApiBehaviorOptions(options =>
{
    options.InvalidModelStateResponseFactory = _ => new BadRequestObjectResult(
        new ErrorResponse(new ErrorDetail("VALIDATION_ERROR", "The request is invalid.")));
});
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    var origins = builder.Configuration.GetSection("Api:AllowedOrigins").Get<string[]>() ?? [];
    if (origins.Length > 0)
        policy.WithOrigins(origins).WithMethods("GET").AllowAnyHeader();
}));

var app = builder.Build();
app.Use(async (context, next) =>
{
    try
    {
        await next(context);
    }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
    {
        context.Abort();
    }
    catch (Exception exception) when (!context.Response.HasStarted)
    {
        var (status, code, message) = exception switch
        {
            CatalogUnavailableException => (503, "CATALOG_UNAVAILABLE", "The landing-site catalog is unavailable."),
            BadHttpRequestException => (400, "VALIDATION_ERROR", "The request is invalid."),
            _ => (500, "INTERNAL_ERROR", "An unexpected server error occurred.")
        };
        app.Logger.LogWarning("Request failed with {ErrorCode} ({FailureType}).", code, exception.GetType().Name);
        context.Response.Clear();
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ErrorResponse(new ErrorDetail(code, message)), context.RequestAborted);
    }
});
app.UseStatusCodePages(async statusContext =>
{
    var response = statusContext.HttpContext.Response;
    var (code, message) = response.StatusCode switch
    {
        404 => ("NOT_FOUND", "The requested endpoint was not found."),
        405 => ("METHOD_NOT_ALLOWED", "The HTTP method is not supported."),
        _ => ("REQUEST_ERROR", "The request could not be completed.")
    };
    await response.WriteAsJsonAsync(new ErrorResponse(new ErrorDetail(code, message)),
        statusContext.HttpContext.RequestAborted);
});
app.UseRouting();
app.UseCors();
app.MapControllers();
app.Run();

public partial class Program;
