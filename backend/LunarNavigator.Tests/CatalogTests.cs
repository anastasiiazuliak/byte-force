using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using LunarNavigator.Api.Contracts;
using LunarNavigator.Api.Foundation;
using LunarNavigator.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace LunarNavigator.Tests;

public sealed class CatalogTests
{
    private static LandingSite Demo => new("demo-a", "DEMO A", "DEMO synthetic point", -89, 25, null);

    [Theory]
    [InlineData(-90, -180, true)]
    [InlineData(-80, 180, true)]
    [InlineData(-79.99, 0, false)]
    [InlineData(-90.01, 0, false)]
    [InlineData(-89, 180.01, false)]
    [InlineData(double.NaN, 0, false)]
    [InlineData(-89, double.PositiveInfinity, false)]
    public void IsValid_RequiresFiniteCoordinatesWithinRegion(double latitude, double longitude, bool valid) =>
        Assert.Equal(valid, JsonLandingSiteCatalog.IsValid(Demo with { Latitude = latitude, Longitude = longitude }));

    [Fact]
    public void IsValid_RequiresSourceOrExplicitDemoLabel()
    {
        Assert.True(JsonLandingSiteCatalog.IsValid(Demo));
        Assert.False(JsonLandingSiteCatalog.IsValid(Demo with { Name = "Landing A" }));
        Assert.False(JsonLandingSiteCatalog.IsValid(Demo with { SourceUrl = "javascript:alert(1)" }));
        Assert.False(JsonLandingSiteCatalog.IsValid(Demo with { SourceUrl = "https://user:password@example.org" }));
        Assert.True(JsonLandingSiteCatalog.IsValid(Demo with { Id = "site-a", Name = "Site A", SourceUrl = "https://example.org/source" }));
    }

    [Fact]
    public async Task GetAsync_FiltersInvalidEntriesAndEveryDuplicate()
    {
        using var factory = new ApiFactory();
        var directory = Path.Combine(Path.GetTempPath(), "lunar-catalog-" + Guid.NewGuid());
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "catalog.json");
        try
        {
            var sites = new[] { Demo, Demo with { Id = "DEMO-A" }, Demo with { Id = "demo-b" },
                Demo with { Id = "demo-invalid", Latitude = -70 } };
            await File.WriteAllTextAsync(path, JsonSerializer.Serialize(new LandingSitesResponse(sites), new JsonSerializerOptions(JsonSerializerDefaults.Web)));
            var catalog = new JsonLandingSiteCatalog(factory.Services.GetRequiredService<IWebHostEnvironment>(),
                Options.Create(new ApiSettings { CatalogPath = path }), NullLogger<JsonLandingSiteCatalog>.Instance);
            Assert.Equal("demo-b", Assert.Single(await catalog.GetAsync(CancellationToken.None)).Id);
            using var cancelled = new CancellationTokenSource();
            cancelled.Cancel();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => catalog.GetAsync(cancelled.Token));
            await File.WriteAllTextAsync(path, "{broken");
            await Assert.ThrowsAsync<CatalogUnavailableException>(() => catalog.GetAsync(CancellationToken.None));
        }
        finally
        {
            File.Delete(path);
            Directory.Delete(directory);
        }
    }

    [Fact]
    public void Validate_RejectsInvalidLimitsAndWildcardOrigins()
    {
        var settings = new ApiSettings { MinStepMinutes = 60, MaxStepMinutes = 10, AllowedOrigins = ["*"] };
        Assert.Equal(2, settings.Validate(new ValidationContext(settings)).Count());
    }
}
