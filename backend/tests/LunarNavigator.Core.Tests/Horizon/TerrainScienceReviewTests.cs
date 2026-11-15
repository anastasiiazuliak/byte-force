using System.Security.Cryptography;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Horizon;
using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Core.Tests.Horizon;

public sealed class TerrainScienceReviewTests
{
    [Fact]
    public void PixelIsArea_UsesNativeCellCentersNotTiepointCorners()
    {
        var metadata = LolaDemMetadata.Default with { RasterPixelIsArea = true };
        Assert.Equal((-303960.0, 303960.0), LunarProjection.FromPixel(0, 0, metadata));
        Assert.Equal((0.0, 0.0), LunarProjection.ToPixel(-303960, 303960, metadata));
        Assert.Equal((40.0, -40.0), LunarProjection.FromPixel(3800, 3800, metadata));
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(90, 90)]
    [InlineData(180, 180)]
    [InlineData(270, -90)]
    public void PoleDestination_HasAnalyticLatitudeAndEastPositiveLongitude(double az, double lon)
    {
        var point = LolaHorizonService.Destination(new(-90, 0), az, 5000);
        Assert.Equal(-90 + 5000 / 1737400.0 * 180 / Math.PI, point.Latitude, 10);
        Assert.Equal(lon, point.Longitude, 9);
    }

    [Theory]
    [InlineData(-80, 45, 90, 20000)]
    [InlineData(-89, -170, 230, 5000)]
    public void Destination_MatchesIndependentSphericalCosineDistance(double lat, double lon, double az, double distance)
    {
        var result = LolaHorizonService.Destination(new(lat, lon), az, distance);
        double a = lat * Math.PI / 180, b = result.Latitude * Math.PI / 180;
        double delta = (result.Longitude - lon) * Math.PI / 180;
        double measured = 1737400 * Math.Acos(Math.Clamp(Math.Sin(a) * Math.Sin(b) + Math.Cos(a) * Math.Cos(b) * Math.Cos(delta), -1, 1));
        Assert.InRange(Math.Abs(measured - distance), 0, 0.00001);
    }

    [Theory]
    [InlineData(256, ulong.MaxValue)]
    [InlineData(322, 2147483647)]
    [InlineData(324, 1000001)]
    [InlineData(317, 2)]
    public void UntrustedTiffMetadata_IsRejectedBeforeAllocation(int tag, ulong value)
    {
        var bytes = File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Terrain/Fixtures/synthetic_lola_sample.tif"));
        int ifd = checked((int)BitConverter.ToUInt64(bytes, 8));
        int count = checked((int)BitConverter.ToUInt64(bytes, ifd));
        for (int i = 0; i < count; i++)
        {
            int entry = ifd + 8 + i * 20;
            if (BitConverter.ToUInt16(bytes, entry) == tag)
                BitConverter.GetBytes(value).CopyTo(bytes, entry + (tag == 324 ? 4 : 12));
        }
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".tif");
        try
        {
            File.WriteAllBytes(path, bytes);
            Assert.Throws<InvalidDataException>(() => LolaTiffReader.Open(path));
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void DeclaredFiniteNoData_IsNotReturnedAsARealHeight()
    {
        var bytes = File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Terrain/Fixtures/synthetic_lola_sample.tif"));
        int ifd = checked((int)BitConverter.ToUInt64(bytes, 8));
        int count = checked((int)BitConverter.ToUInt64(bytes, ifd));
        for (int i = 0; i < count; i++)
        {
            int entry = ifd + 8 + i * 20;
            if (BitConverter.ToUInt16(bytes, entry) != 262) continue;
            BitConverter.GetBytes((ushort)42113).CopyTo(bytes, entry);
            BitConverter.GetBytes((ushort)2).CopyTo(bytes, entry + 2);
            BitConverter.GetBytes(6ul).CopyTo(bytes, entry + 4);
            Array.Clear(bytes, entry + 12, 8);
            System.Text.Encoding.ASCII.GetBytes("-2500\0").CopyTo(bytes, entry + 12);
        }
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".tif");
        try
        {
            File.WriteAllBytes(path, bytes);
            using var reader = LolaTiffReader.Open(path);
            Assert.True(float.IsNaN(reader.ReadPixel(256,256)));
            Assert.Equal(2100f, reader.ReadPixel(356,256));
        }
        finally { File.Delete(path); }
    }

    [RealDemScienceFact]
    public void RealDem_ChangedPayloadOrGeotagsOrLengthNeverReceivesApproval()
    {
        string source = Environment.GetEnvironmentVariable("SCIENCE_REAL_DEM")!;
        string path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".tif");
        try
        {
            File.Copy(source,path);
            using (var file = new FileStream(path,FileMode.Open,FileAccess.ReadWrite))
            {
                file.Position = file.Length - 1;
                int original = file.ReadByte();
                file.Position--;
                file.WriteByte((byte)(original ^ 1));
            }
            using (var changed = LolaTiffReader.Open(path)) Assert.False(changed.HasReviewedDatumAlignment);
            // Restore identity then alter the native pixel scale, leaving dimensions/layout valid.
            File.Copy(source,path,true);
            using (var file = new FileStream(path,FileMode.Open,FileAccess.ReadWrite))
            using (var reader = new BinaryReader(file,System.Text.Encoding.UTF8,true))
            {
                file.Position = 8;
                long ifd = reader.ReadInt64();
                file.Position = ifd;
                ulong count = reader.ReadUInt64();
                for (ulong i=0; i<count; i++)
                {
                    file.Position = ifd + 8 + (long)i * 20;
                    if (reader.ReadUInt16() != 33550) continue;
                    file.Position += 10;
                    long offset = reader.ReadInt64();
                    file.Position = offset;
                    file.Write(BitConverter.GetBytes(81.0));
                    break;
                }
            }
            using (var changed = LolaTiffReader.Open(path)) Assert.False(changed.HasReviewedDatumAlignment);
            File.Copy(source,path,true);
            using (var file = new FileStream(path,FileMode.Open,FileAccess.Write)) file.SetLength(file.Length-1);
            using (var changed = LolaTiffReader.Open(path)) Assert.False(changed.HasReviewedDatumAlignment);
        }
        finally { File.Delete(path); }
    }

    [RealDemScienceFact]
    public async Task RealDem_OptInIdentityNativeControlsAllFullResolutionTilesAndGate()
    {
        var path = Environment.GetEnvironmentVariable("SCIENCE_REAL_DEM");
        Assert.False(string.IsNullOrEmpty(path));
        using (var stream = File.OpenRead(path))
            Assert.Equal("82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a", Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant());
        using var reader = LolaTiffReader.Open(path, 2);
        Assert.True(reader.HasReviewedDatumAlignment);
        // Native Float32 bit patterns independently decoded in Python stdlib; not physical ground truth.
        foreach (var (col, row, bits) in new[] { (3800,3800,0x44a0498au), (3800,3900,0x431e31d5u), (4000,4000,0x44805177u), (3500,3500,0xc4a476bau), (500,500,0x456eb979u), (0,0,0x4413dc8eu), (7599,7599,0xc5901f44u) })
            Assert.Equal(bits, BitConverter.SingleToUInt32Bits(reader.ReadPixel(col, row)));
        for (int i = 0; i < reader.Metadata.TotalTiles; i++)
            Assert.Equal(512 * 512, reader.GetTile(i).Length);
        using var terrain = new LolaTerrainService(reader);
        Assert.False((await terrain.GetElevationAsync(new(-90,0))).DatumAlignmentVerified);
        Assert.Null((await terrain.GetElevationAsync(new(-79,0))).ElevationM);
        Assert.Null((await terrain.GetElevationAsync(new(double.NaN,0))).ElevationM);
        var profile = await new LolaHorizonService(terrain).GetProfileAsync(new(-89,25), new HorizonOptions { MaxRangeMeters = 5000, AzimuthStepDeg = 10, ObserverHeightOffsetMeters = 0 });
        Assert.NotEmpty(profile.Points);
        Assert.Contains(profile.Warnings, w => w.Contains("not proof of global visibility"));
    }
}

public sealed class RealDemScienceFactAttribute : FactAttribute
{
    public RealDemScienceFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SCIENCE_REAL_DEM")))
            Skip = "Set SCIENCE_REAL_DEM to opt in to the 189 MB NASA asset validation.";
    }
}
