using System.Security.Cryptography;
using System.Text.Json;
using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Core.Tests.Horizon;

public sealed class ReviewedMeshNativeProofTests
{
    [ReviewedMeshesFact]
    public void CurrentMeshes_AllNativeVerticesMatchReviewedOpenedDem()
    {
        using var reader = LolaTiffReader.Open(Environment.GetEnvironmentVariable("SCIENCE_REAL_DEM")!,2);
        Assert.True(reader.HasReviewedDatumAlignment);
        string root = Environment.GetEnvironmentVariable("SCIENCE_MESH_ROOT")!;
        foreach (var (site, expectedHash) in new[] {
            ("connecting-ridge","c2135ab984b8a4ac7ea80d907a38fb381f31a43da6b8cb034faf9c7e6f261851"),
            ("near-shackleton","c0deeb10fd145ffea8191077d5b563af3b31608693adcac1fcdd75b9164a117f"),
            ("near-de-gerlache","42ea98eeb08a9b437ad6f14bad553a30db85edd8c499128b12b2b374e9e26f58") })
        {
            byte[] bytes = File.ReadAllBytes(Path.Combine(root,site,"terrain.glb"));
            Assert.Equal(expectedHash,Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
            using var manifest = JsonDocument.Parse(File.ReadAllBytes(Path.Combine(root,site,"terrain-manifest.json")));
            var m = manifest.RootElement;
            Assert.Equal(LolaTiffReader.ReviewedDemSha256,m.GetProperty("sourceLocalSha256").GetString());
            Assert.Equal(0x46546c67u,BitConverter.ToUInt32(bytes,0));
            Assert.Equal(2u,BitConverter.ToUInt32(bytes,4));
            Assert.Equal((uint)bytes.Length,BitConverter.ToUInt32(bytes,8));
            int jsonLength = checked((int)BitConverter.ToUInt32(bytes,12));
            Assert.Equal(0x4e4f534au,BitConverter.ToUInt32(bytes,16));
            using var gltf = JsonDocument.Parse(bytes.AsMemory(20,jsonLength));
            var g = gltf.RootElement;
            var node = Assert.Single(g.GetProperty("nodes").EnumerateArray());
            foreach (string transform in new[] { "matrix","translation","rotation","scale" })
                Assert.False(node.TryGetProperty(transform,out _));
            var primitive = g.GetProperty("meshes")[0].GetProperty("primitives")[0];
            var accessor = g.GetProperty("accessors")[primitive.GetProperty("attributes").GetProperty("POSITION").GetInt32()];
            Assert.Equal(5126,accessor.GetProperty("componentType").GetInt32());
            Assert.Equal("VEC3",accessor.GetProperty("type").GetString());
            var view = g.GetProperty("bufferViews")[accessor.GetProperty("bufferView").GetInt32()];
            int bin = 20 + jsonLength;
            Assert.Equal(0x004e4942u,BitConverter.ToUInt32(bytes,bin+4));
            int start = bin + 8 + view.GetProperty("byteOffset").GetInt32() + accessor.GetProperty("byteOffset").GetInt32();
            int width = m.GetProperty("gridSizePixels").GetProperty("width").GetInt32();
            int height = m.GetProperty("gridSizePixels").GetProperty("height").GetInt32();
            int count = accessor.GetProperty("count").GetInt32();
            Assert.Equal(width * height,count);
            var bounds = m.GetProperty("sampleBoundsProjectedMeters");
            var origin = m.GetProperty("meshLocalOrigin");
            double ox = origin[0].GetDouble(), oy = origin[1].GetDouble(), oz = origin[2].GetDouble();
            for (int i=0; i<count; i++)
            {
                double x = BitConverter.ToSingle(bytes,start+i*12) + ox;
                double z = BitConverter.ToSingle(bytes,start+i*12+4) + oz;
                double y = oy - BitConverter.ToSingle(bytes,start+i*12+8);
                double expectedX = bounds.GetProperty("minX").GetDouble() + i % width * 80;
                double expectedY = bounds.GetProperty("maxY").GetDouble() - i / width * 80;
                Assert.InRange(Math.Abs(x-expectedX),0,0.001);
                Assert.InRange(Math.Abs(y-expectedY),0,0.001);
                var pixel = LunarProjection.ToPixel(expectedX,expectedY,reader.Metadata);
                Assert.InRange(Math.Abs(pixel.Col-Math.Round(pixel.Col)),0,1e-8);
                Assert.InRange(Math.Abs(pixel.Row-Math.Round(pixel.Row)),0,1e-8);
                float native = reader.ReadPixel((int)Math.Round(pixel.Col),(int)Math.Round(pixel.Row));
                Assert.True(float.IsFinite(native));
                Assert.InRange(Math.Abs(z-native),0,0.001);
            }
            Assert.Equal(93750,g.GetProperty("accessors")[primitive.GetProperty("indices").GetInt32()].GetProperty("count").GetInt32());
        }
    }
}

public sealed class ReviewedMeshesFactAttribute : FactAttribute
{
    public ReviewedMeshesFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SCIENCE_REAL_DEM")) ||
            string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SCIENCE_MESH_ROOT")))
            Skip = "Set SCIENCE_REAL_DEM and SCIENCE_MESH_ROOT for identity-bound native mesh proof.";
    }
}
