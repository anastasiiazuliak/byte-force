using System.Buffers.Binary;
using System.Text;
using System.Text.Json;
using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Core.Tests.Terrain;

public class MeshPipelineTests
{
    private const uint GlbMagic = 0x46546C67; // "glTF"
    private const uint JsonChunkType = 0x4E4F534A; // "JSON"
    private const uint BinChunkType = 0x004E4942;  // "BIN\0"
    private const int MaxCiAssetSizeBytes = 10 * 1024 * 1024; // 10 MB

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "public-assets")) &&
                Directory.Exists(Path.Combine(dir.FullName, "data-pipeline")))
            {
                return dir.FullName;
            }
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Could not locate repository root containing public-assets/ and data-pipeline/.");
    }

    [Fact]
    public void TerrainManifest_ExistsAndContainsRequiredMetadata()
    {
        string root = FindRepoRoot();
        string manifestPath = Path.Combine(root, "public-assets", "metadata", "terrain-manifest.json");
        Assert.True(File.Exists(manifestPath), $"Manifest not found: {manifestPath}");

        using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(manifestPath));
        JsonElement rootEl = doc.RootElement;

        Assert.True(rootEl.TryGetProperty("boundsProjectedMeters", out JsonElement projBounds));
        Assert.True(projBounds.GetProperty("maxX").GetDouble() > projBounds.GetProperty("minX").GetDouble());
        Assert.True(projBounds.GetProperty("maxY").GetDouble() > projBounds.GetProperty("minY").GetDouble());

        Assert.True(rootEl.TryGetProperty("boundsGeographic", out JsonElement geoBounds));
        Assert.True(geoBounds.GetProperty("minLat").GetDouble() >= -90.0);
        Assert.True(geoBounds.GetProperty("maxLat").GetDouble() <= -80.0);

        Assert.True(rootEl.TryGetProperty("meshLocalOrigin", out JsonElement origin));
        Assert.Equal(3, origin.GetArrayLength());

        Assert.Equal("LDEM_80S_80MPP_ADJ.TIF", rootEl.GetProperty("sourceDataset").GetString());
        Assert.Contains("1737400", rootEl.GetProperty("verticalReference").GetString());
        Assert.False(string.IsNullOrWhiteSpace(rootEl.GetProperty("attribution").GetString()));
        Assert.Equal("public-assets/terrain/0/0/0.glb", rootEl.GetProperty("meshFile").GetString());
    }

    [Fact]
    public void DemoGlbAsset_IsValidGltf2BinaryAndWithinSizeLimit()
    {
        string root = FindRepoRoot();
        string glbPath = Path.Combine(root, "public-assets", "terrain", "0", "0", "0.glb");
        Assert.True(File.Exists(glbPath), $"GLB asset not found: {glbPath}");

        byte[] bytes = File.ReadAllBytes(glbPath);
        Assert.InRange(bytes.Length, 1024, MaxCiAssetSizeBytes);

        // GLB 12-byte header
        uint magic = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(0, 4));
        uint version = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(4, 4));
        uint totalLength = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(8, 4));

        Assert.Equal(GlbMagic, magic);
        Assert.Equal(2u, version);
        Assert.Equal((uint)bytes.Length, totalLength);

        // Chunk 0: JSON
        uint jsonLength = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(12, 4));
        uint jsonType = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(16, 4));
        Assert.Equal(JsonChunkType, jsonType);

        string jsonText = Encoding.UTF8.GetString(bytes, 20, (int)jsonLength);
        using JsonDocument gltf = JsonDocument.Parse(jsonText);
        JsonElement g = gltf.RootElement;

        Assert.Equal("2.0", g.GetProperty("asset").GetProperty("version").GetString());
        JsonElement primitive = g.GetProperty("meshes")[0].GetProperty("primitives")[0];
        JsonElement attrs = primitive.GetProperty("attributes");
        Assert.True(attrs.TryGetProperty("POSITION", out _));
        Assert.True(attrs.TryGetProperty("NORMAL", out _));
        Assert.True(attrs.TryGetProperty("TEXCOORD_0", out _));
        Assert.True(primitive.TryGetProperty("indices", out _));

        // Verify POSITION min/max are finite and show real terrain relief (> 100 m range)
        JsonElement posAccessor = g.GetProperty("accessors")[0];
        double minY = posAccessor.GetProperty("min")[1].GetDouble();
        double maxY = posAccessor.GetProperty("max")[1].GetDouble();
        Assert.True(double.IsFinite(minY) && double.IsFinite(maxY));
        Assert.True(maxY - minY > 100.0, $"Expected real relief > 100m, got {maxY - minY}m");

        // Chunk 1: BIN
        int binHeaderOffset = 20 + (int)jsonLength;
        uint binLength = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(binHeaderOffset, 4));
        uint binType = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(binHeaderOffset + 4, 4));
        Assert.Equal(BinChunkType, binType);
        Assert.True(binLength >= (uint)g.GetProperty("buffers")[0].GetProperty("byteLength").GetInt64());
    }

    [Fact]
    public void MeshLocalOrigin_RoundTripsToConnectingRidgeLatLon()
    {
        string root = FindRepoRoot();
        string manifestPath = Path.Combine(root, "public-assets", "metadata", "terrain-manifest.json");
        using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(manifestPath));
        JsonElement rootEl = doc.RootElement;

        double expectedLat = rootEl.GetProperty("centerLatDeg").GetDouble();
        double expectedLon = rootEl.GetProperty("centerLonDeg").GetDouble();
        double originX = rootEl.GetProperty("meshLocalOrigin")[0].GetDouble();
        double originY = rootEl.GetProperty("meshLocalOrigin")[1].GetDouble();

        var (lat, lon) = LunarProjection.ToGeographic(originX, originY);
        Assert.InRange(Math.Abs(lat - expectedLat), 0.0, 1e-6);
        Assert.InRange(Math.Abs(lon - expectedLon), 0.0, 1e-6);
    }
}
