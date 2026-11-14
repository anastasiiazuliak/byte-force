using LunarNavigator.Core.Analysis;
using Microsoft.Extensions.DependencyInjection.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));
builder.Services.TryAddSingleton<ITerrainHeightProvider, UnavailableTerrainHeightProvider>();
builder.Services.TryAddSingleton<IHorizonProfileProvider, UnavailableHorizonProfileProvider>();

var app = builder.Build();
app.UseCors("Frontend");
// Liveness only: this does not assert availability of scientific data providers.
app.MapGet("/api/v1/health", () => Results.Ok(new { status = "ok", version = "0.1.0" }));
app.Run();

public partial class Program { }
