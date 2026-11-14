using System.Text.Json;
using LunarNavigator.Api.Infrastructure.Map;
using LunarNavigator.Api.Tests.TestSupport;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Map;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace LunarNavigator.Api.Tests.Map;

public sealed class MapMetadataServiceTests
{
    private static MapMetadata Metadata => new("lunar-south-pole",
        new MapProjection("south-polar-stereographic", "+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m", "MOON_ME", "m"),
        new MapRender("projected-terrain", 256, 0, 0, new ProjectedBounds(-10, -10, 10, 10), new SceneTransform(0, 0, 0, true)),
        new MapAssets(null, null, null, "/terrain/test.glb"), new TerrainDataset("SYNTHETIC TEST ONLY", 80, "TEST DATUM", true));

    [Fact]
    public async Task Metadata_ValidatesManifestAndExistingAssetsWithoutChangingCoordinates()
    {
        using var fixture = new ManifestFixture();
        var result = await fixture.GetAsync(new MapManifest(1, Metadata));
        Assert.Equal(Metadata, result);
        var unverified = Metadata with
        {
            Projection = Metadata.Projection with { ProjDefinition = null, SourceFrame = null },
            Render = Metadata.Render with { BoundsMeters = null, SceneTransform = null },
            TerrainDataset = Metadata.TerrainDataset with { VerticalReference = null, MetadataVerified = false }
        };
        Assert.False((await fixture.GetAsync(new MapManifest(1, unverified))).TerrainDataset.MetadataVerified);
    }

    [Fact]
    public async Task Metadata_RequiresAssetChecksForTemplates()
    {
        using var fixture = new ManifestFixture();
        var tiled = Metadata with { Assets = new MapAssets("/terrain/{z}/{x}/{y}.glb", null, null, null) };
        await fixture.AssertUnavailableAsync(new MapManifest(1, tiled));
        fixture.Asset("terrain/1/0/0.glb");
        await fixture.AssertUnavailableAsync(new MapManifest(1, tiled, ["/terrain/1/0/0.glb"]));
        fixture.Asset("terrain/0/0/0.glb");
        Assert.True((await fixture.GetAsync(new MapManifest(1, tiled, ["/terrain/0/0/0.glb"]))).TerrainDataset.MetadataVerified);
    }

    [Fact]
    public async Task Metadata_RejectsMissingManifestWrongVersionAndMissingAssets()
    {
        using var fixture = new ManifestFixture();
        await Assert.ThrowsAsync<NavigationException>(() => fixture.Service.GetAsync());
        await fixture.AssertUnavailableAsync(new MapManifest(2, Metadata));
        await fixture.AssertUnavailableAsync(new MapManifest(1, Metadata with { Assets = Metadata.Assets with { DemoMeshUrl = "/missing.glb" } }));
        await File.WriteAllTextAsync(fixture.ManifestPath, "{broken");
        await Assert.ThrowsAsync<NavigationException>(() => fixture.Service.GetAsync());
    }

    [Fact]
    public async Task Metadata_RejectsEarthCrsWrongFrameTransformAndBounds()
    {
        using var fixture = new ManifestFixture();
        foreach (var value in new[]
        {
            Metadata with { Projection = Metadata.Projection with { ProjDefinition = "+proj=merc +R=6378137 +units=m" } },
            Metadata with { Projection = Metadata.Projection with { SourceFrame = "EARTH_FIXED" } },
            Metadata with { Projection = Metadata.Projection with { ProjDefinition = "<REPLACE_ME>" } },
            Metadata with { Render = Metadata.Render with { SceneTransform = new SceneTransform(0, 0, 0, false) } },
            Metadata with { Render = Metadata.Render with { BoundsMeters = new ProjectedBounds(10, 0, -10, 20) } },
            Metadata with { TerrainDataset = Metadata.TerrainDataset with { VerticalReference = null } }
        }) await fixture.AssertUnavailableAsync(new MapManifest(1, value));
    }

    [Fact]
    public async Task Metadata_RejectsTraversalAndUnconfiguredRemoteOrigins()
    {
        using var fixture = new ManifestFixture();
        fixture.Asset("terrain/not-a-mesh.txt");
        foreach (var path in new[] { "../outside.glb", "/terrain/%2e%2e/outside.glb", "https://untrusted.example/test.glb", "//untrusted.example/test.glb", "/terrain/not-a-mesh.txt" })
            await fixture.AssertUnavailableAsync(new MapManifest(1, Metadata with { Assets = Metadata.Assets with { DemoMeshUrl = path } }));
    }

    private sealed class ManifestFixture : IDisposable
    {
        private readonly ApiFactory _factory = new();
        private readonly string _root = Path.Combine(Path.GetTempPath(), "lunar-manifest-" + Guid.NewGuid());
        public string ManifestPath => Path.Combine(_root, "manifest.json");
        public FileMapMetadataService Service { get; }

        public ManifestFixture()
        {
            Directory.CreateDirectory(_root);
            Service = new FileMapMetadataService(_factory.Services.GetRequiredService<IWebHostEnvironment>(),
                Options.Create(new MapManifestSettings { ManifestPath = ManifestPath, AssetRootPath = _root }));
            Asset("terrain/test.glb");
        }

        public void Asset(string relative)
        {
            var file = Path.Combine(_root, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            File.WriteAllText(file, "SYNTHETIC TEST ASSET ONLY");
        }

        public async Task<MapMetadata> GetAsync(MapManifest manifest)
        {
            await File.WriteAllTextAsync(ManifestPath, JsonSerializer.Serialize(manifest, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
            return await Service.GetAsync();
        }

        public async Task AssertUnavailableAsync(MapManifest manifest) =>
            Assert.Equal("TERRAIN_DATA_UNAVAILABLE", (await Assert.ThrowsAsync<NavigationException>(() => GetAsync(manifest))).Code);

        public void Dispose()
        {
            _factory.Dispose();
            Directory.Delete(_root, recursive: true);
        }
    }
}
