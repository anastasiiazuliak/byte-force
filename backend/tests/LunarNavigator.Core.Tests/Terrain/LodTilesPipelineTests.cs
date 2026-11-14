using System.Buffers.Binary;
using System.Text;
using System.Text.Json;
using Xunit;

namespace LunarNavigator.Core.Tests.Terrain;

public class LodTilesPipelineTests
{
    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "public-assets")) &&
                Directory.Exists(Path.Combine(dir.FullName, "contracts")))
            {
                return dir.FullName;
            }
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Could not locate repository root.");
    }

    [Fact]
    public void LodTilesetManifest_HasAtLeastThreeLodLevels_AndHonestCoverage()
    {
        string root = FindRepoRoot();
        string path = Path.Combine(root, "public-assets", "metadata", "lod-tileset.json");
        Assert.True(File.Exists(path), $"LOD tileset manifest missing: {path}");

        using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement r = doc.RootElement;

        Assert.Equal("XYZ", r.GetProperty("tileGridScheme").GetString());
        int minZoom = r.GetProperty("minZoom").GetInt32();
        int maxZoom = r.GetProperty("maxZoom").GetInt32();
        Assert.True(maxZoom - minZoom + 1 >= 3, "Expected at least 3 LOD levels.");

        Assert.True(r.GetProperty("skirtDepthMeters").GetDouble() >= 50.0);
        Assert.False(r.GetProperty("coverage").GetProperty("fullSouthPole80S90S").GetBoolean());
        Assert.False(r.GetProperty("coverage").GetProperty("lrocImageryAvailable").GetBoolean());

        JsonElement levels = r.GetProperty("lodLevels");
        Assert.Equal(maxZoom - minZoom + 1, levels.GetArrayLength());

        double prevSpacing = double.MaxValue;
        foreach (JsonElement lvl in levels.EnumerateArray())
        {
            double spacing = lvl.GetProperty("vertexSpacingMeters").GetDouble();
            Assert.True(spacing < prevSpacing, "Each higher zoom level must refine vertex spacing.");
            prevSpacing = spacing;
        }
    }

    [Fact]
    public void RealMapMetadataFixture_MatchesBe06AndTilesSchema()
    {
        string root = FindRepoRoot();
        string path = Path.Combine(root, "contracts", "fixtures", "map-metadata-real.json");
        Assert.True(File.Exists(path), $"Real map metadata fixture missing: {path}");

        using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement r = doc.RootElement;

        Assert.Equal(1, r.GetProperty("schemaVersion").GetInt32());
        JsonElement meta = r.GetProperty("metadata");
        Assert.Equal("lunar-south-pole", meta.GetProperty("regionId").GetString());
        Assert.Equal("south-polar-stereographic", meta.GetProperty("projection").GetProperty("name").GetString());
        Assert.Equal("MOON_ME", meta.GetProperty("projection").GetProperty("sourceFrame").GetString());
        Assert.Contains("+R=1737400", meta.GetProperty("projection").GetProperty("projDefinition").GetString());

        JsonElement assets = meta.GetProperty("assets");
        Assert.Equal("/terrain/{z}/{x}/{y}.glb", assets.GetProperty("terrainTemplate").GetString());
        Assert.Equal("/tiles/hillshade/{z}/{x}/{y}.webp", assets.GetProperty("hillshadeTemplate").GetString());
        Assert.Equal("/terrain/0/0/0.glb", assets.GetProperty("demoMeshUrl").GetString());

        JsonElement required = r.GetProperty("requiredAssets");
        Assert.True(required.GetArrayLength() >= 21); // 1 + 4 + 16 GLB tiles minimum
    }

    [Fact]
    public void AdjacentTiles_ShareIdenticalBoundaryCoordinates_WhenGeneratedLocally()
    {
        string root = FindRepoRoot();
        string leftPath = Path.Combine(root, "public-assets", "terrain", "2", "0", "0.glb");
        string rightPath = Path.Combine(root, "public-assets", "terrain", "2", "1", "0.glb");

        if (!File.Exists(leftPath) || !File.Exists(rightPath))
        {
            // Higher-zoom tiles are gitignored in CI; only verify when generated locally.
            return;
        }

        var leftVerts = ReadPositionsFromGlb(leftPath);
        var rightVerts = ReadPositionsFromGlb(rightPath);

        // 33x33 surface grid (1089 surface vertices before perimeter skirts)
        const int n = 33;
        for (int row = 0; row < n; row++)
        {
            var rightEdgeOfLeftTile = leftVerts[(row * n) + (n - 1)];
            var leftEdgeOfRightTile = rightVerts[(row * n) + 0];

            Assert.InRange(Math.Abs(rightEdgeOfLeftTile.X - leftEdgeOfRightTile.X), 0f, 1e-3f);
            Assert.InRange(Math.Abs(rightEdgeOfLeftTile.Y - leftEdgeOfRightTile.Y), 0f, 1e-3f);
            Assert.InRange(Math.Abs(rightEdgeOfLeftTile.Z - leftEdgeOfRightTile.Z), 0f, 1e-3f);
        }
    }

    private static (float X, float Y, float Z)[] ReadPositionsFromGlb(string path)
    {
        byte[] bytes = File.ReadAllBytes(path);
        uint jsonLen = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(12, 4));
        string json = Encoding.UTF8.GetString(bytes, 20, (int)jsonLen);
        using JsonDocument doc = JsonDocument.Parse(json);
        int vertCount = doc.RootElement.GetProperty("accessors")[0].GetProperty("count").GetInt32();

        int binStart = 20 + (int)jsonLen + 8;
        var result = new (float, float, float)[vertCount];
        for (int i = 0; i < vertCount; i++)
        {
            int off = binStart + (i * 12);
            float x = BinaryPrimitives.ReadSingleLittleEndian(bytes.AsSpan(off, 4));
            float y = BinaryPrimitives.ReadSingleLittleEndian(bytes.AsSpan(off + 4, 4));
            float z = BinaryPrimitives.ReadSingleLittleEndian(bytes.AsSpan(off + 8, 4));
            result[i] = (x, y, z);
        }
        return result;
    }
}
