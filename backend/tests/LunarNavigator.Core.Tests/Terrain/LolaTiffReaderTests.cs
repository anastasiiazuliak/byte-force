using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Core.Tests.Terrain;

public sealed class LolaTiffReaderTests
{
    private static string GetFixturePath()
    {
        string baseDir = AppContext.BaseDirectory;
        string path = Path.Combine(baseDir, "Terrain", "Fixtures", "synthetic_lola_sample.tif");
        if (File.Exists(path)) return path;

        // Fallback for direct test runner paths
        string repoDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", ".."));
        return Path.Combine(repoDir, "Terrain", "Fixtures", "synthetic_lola_sample.tif");
    }

    [Fact]
    public void Open_SyntheticBigTiff_ParsesMetadataAndReadsPixels()
    {
        string fixturePath = GetFixturePath();
        Assert.True(File.Exists(fixturePath), $"Fixture must exist at {fixturePath}");

        using var reader = LolaTiffReader.Open(fixturePath);
        Assert.NotNull(reader);
        Assert.Equal(512, reader.Metadata.RasterWidth);
        Assert.Equal(512, reader.Metadata.RasterHeight);

        // Center pixel (256, 256) is inside crater
        float centerElev = reader.ReadPixel(256, 256);
        Assert.False(float.IsNaN(centerElev));
        Assert.Equal(-2500.0f, centerElev, 0.1f);

        // Rim pixel (around 256 + 100 = 356, 256)
        float rimElev = reader.ReadPixel(356, 256);
        Assert.False(float.IsNaN(rimElev));
        Assert.Equal(2100.0f, rimElev, 0.1f);

        // Border pixel (> 240 radius, e.g. 500, 256) should be NoData (NaN)
        float borderElev = reader.ReadPixel(500, 256);
        Assert.True(float.IsNaN(borderElev));
    }

    [Theory]
    [InlineData(8)]
    [InlineData(30)]
    [InlineData(100043)]
    public void Open_TruncatedBigTiffRejectsIncompleteHeaderIndexOrPayload(int length)
    {
        var path = Path.Combine(Path.GetTempPath(), "lunar-truncated-" + Guid.NewGuid() + ".tif");
        try
        {
            File.WriteAllBytes(path, File.ReadAllBytes(GetFixturePath())[..length]);
            Assert.Throws<InvalidDataException>(() => LolaTiffReader.Open(path));
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public async Task Decode_CorruptCompressedTileIsRejectedInsteadOfReturningPooledBytes()
    {
        var path = Path.Combine(Path.GetTempPath(), "lunar-corrupt-" + Guid.NewGuid() + ".tif");
        try
        {
            var bytes = File.ReadAllBytes(GetFixturePath());
            // This synthetic fixture has one inline tile offset in its BigTIFF index.
            int ifd = checked((int)BitConverter.ToInt64(bytes, 8));
            int count = checked((int)BitConverter.ToUInt64(bytes, ifd));
            for (int i = 0; i < count; i++)
            {
                int entry = ifd + 8 + i * 20;
                if (BitConverter.ToUInt16(bytes, entry) != 324) continue;
                int offset = checked((int)BitConverter.ToInt64(bytes, entry + 12));
                bytes[offset] = 0;
                bytes[offset + 1] = 0;
            }
            File.WriteAllBytes(path, bytes);
            using var reader = LolaTiffReader.Open(path);
            Assert.Throws<InvalidDataException>(() => reader.ReadPixel(256, 256));
            using var terrain = new LolaTerrainService(reader);
            var (lat, lon) = LunarProjection.ToGeographic(
                reader.Metadata.MinX + 256 * reader.Metadata.PixelScaleMeters,
                reader.Metadata.MaxY - 256 * reader.Metadata.PixelScaleMeters);
            var window = await terrain.GetWindowAsync(new(new(lat, lon), 1));
            Assert.False(terrain.IsAvailable);
            Assert.True(window.ContainsNoData);
            Assert.NotEmpty(window.Warnings);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void ReadPixel_OutOfRange_ReturnsNaN()
    {
        string fixturePath = GetFixturePath();
        using var reader = LolaTiffReader.Open(fixturePath);

        Assert.True(float.IsNaN(reader.ReadPixel(-1, 0)));
        Assert.True(float.IsNaN(reader.ReadPixel(0, -1)));
        Assert.True(float.IsNaN(reader.ReadPixel(600, 256)));
        Assert.True(float.IsNaN(reader.ReadPixel(256, 600)));
    }

    [Fact]
    public void ReadWindow_ReturnsCorrectDimensionsAndValues()
    {
        string fixturePath = GetFixturePath();
        using var reader = LolaTiffReader.Open(fixturePath);

        var window = reader.ReadWindow(254, 254, 5, 5);
        Assert.Equal(5, window.GetLength(0)); // rows
        Assert.Equal(5, window.GetLength(1)); // cols

        // Window center is at (2, 2) which corresponds to (256, 256)
        Assert.Equal(-2500.0f, window[2, 2], 0.1f);
    }

    [Fact]
    public void ConcurrentReads_AreThreadSafe()
    {
        string fixturePath = GetFixturePath();
        using var reader = LolaTiffReader.Open(fixturePath);

        Parallel.For(0, 50, i =>
        {
            float val = reader.ReadPixel(256, 256);
            Assert.Equal(-2500.0f, val, 0.1f);

            float rim = reader.ReadPixel(356, 256);
            Assert.Equal(2100.0f, rim, 0.1f);
        });
    }

    [Fact]
    public void Dispose_ReleasesResources_AndThrowsOnSubsequentAccess()
    {
        string fixturePath = GetFixturePath();
        var reader = LolaTiffReader.Open(fixturePath);
        reader.Dispose();

        Assert.Throws<ObjectDisposedException>(() => reader.GetTile(0));
    }
}
