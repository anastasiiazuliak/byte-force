using System.IO.Compression;
using LunarNavigator.Core.Analysis;
using LunarNavigator.Core.Horizon;
using LunarNavigator.Core.Terrain;
using Xunit;

namespace LunarNavigator.Core.Tests.Horizon;

public sealed class BilinearDemSurfaceTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 1)]
    [InlineData(2, 2)]
    [InlineData(0.25, 0.75)]
    [InlineData(0, 0.5)]
    [InlineData(2, 0.5)]
    public void LinearSlope_IsExactAtFractionalCoordinatesCentersAndBorders(double column, double row)
    {
        Assert.True(BilinearDemSurface.TrySample(3,3,column,row,(c,r) => 101.125f + 2*c - 3*r,out double elevation));
        Assert.Equal(101.125 + 2*column - 3*row,elevation,12);
    }

    [Theory]
    [InlineData(-0.01, 0)]
    [InlineData(-1e-12, 0)]
    [InlineData(2.01, 1)]
    [InlineData(1, -0.01)]
    [InlineData(1, 2.01)]
    [InlineData(double.NaN, 1)]
    [InlineData(double.PositiveInfinity, 1)]
    public void OutsideSampleSupport_NeverReadsOrExtrapolates(double column, double row)
    {
        Assert.False(BilinearDemSurface.TrySample(3,3,column,row,(_,_) => throw new InvalidOperationException("Must not read"),out double elevation));
        Assert.True(double.IsNaN(elevation));
    }

    [Fact]
    public void NativeCentersAndEdges_IgnoreOnlyExactlyZeroWeightNoData()
    {
        float[] grid = [10.125f,20.25f,float.NaN,float.NaN];
        float Read(int c,int r) => grid[r*2+c];
        Assert.True(BilinearDemSurface.TrySample(2,2,0,0,Read,out double native));
        Assert.Equal((double)grid[0],native);
        Assert.True(BilinearDemSurface.TrySample(2,2,1,0,Read,out double lastColumn));
        Assert.Equal((double)grid[1],lastColumn);
        Assert.True(BilinearDemSurface.TrySample(2,2,0.25,0,Read,out double edge));
        Assert.Equal(12.65625,edge);
        Assert.False(BilinearDemSurface.TrySample(2,2,0.25,0.01,Read,out _));
        Assert.False(BilinearDemSurface.TrySample(2,2,0,1,Read,out _));
        Assert.False(BilinearDemSurface.TrySample(2,2,0.25,1e-6,Read,out _));
        Assert.False(BilinearDemSurface.TrySample(2,2,0.25,1e-12,Read,out _));
        // One invalid positively weighted corner rejects the entire interpolation, without renormalization.
        Assert.False(BilinearDemSurface.TrySample(2,2,0.5,0.5,(c,r) => c==1 && r==1 ? float.PositiveInfinity : 2,out _));
    }

    [Fact]
    public void NonplanarCell_BilinearAndGlbDiagonalTriangleAreDifferentModels()
    {
        float[] corners = [0,0,0,4];
        Assert.True(BilinearDemSurface.TrySample(2,2,0.5,0.5,(c,r) => corners[r*2+c],out double bilinear));
        Assert.Equal(1,bilinear);
        // The GLB tr-to-bl diagonal joins two zero-height vertices: its midpoint is zero.
        double triangleMidpoint = (corners[1]+corners[2])/2.0;
        Assert.Equal(0,triangleMidpoint);
        Assert.NotEqual(triangleMidpoint,bilinear);
    }

    [Fact]
    public async Task TerrainObserverAndFirstHorizonStep_UseTheSameFractionalLinearSlope()
    {
        string path = WriteLinearSlopeTiff();
        try
        {
            using var terrain = new LolaTerrainService(path);
            Assert.True(terrain.IsAvailable);
            const double col = 3800.25, row = 3800.75;
            var (x,y) = LunarProjection.FromPixel(col,row,terrain.Metadata);
            var (lat,lon) = LunarProjection.ToGeographic(x,y);
            var location = new TerrainLocation(lat,lon);
            var height = await terrain.GetElevationAsync(location);
            double expectedCenter = 101.125 + 2*(col-3800) - 3*(row-3800);
            Assert.Equal(expectedCenter,height.ElevationM!.Value,7);
            Assert.NotEqual(Math.Round(expectedCenter,2),height.ElevationM.Value);
            var profile = await new LolaHorizonService(terrain).GetProfileAsync(location,new HorizonOptions
            {
                MaxRangeMeters = 80, RayStepMeters = 80, AzimuthStepDeg = 90, ObserverHeightOffsetMeters = 0
            });
            Assert.True(profile.TerrainApplied);
            foreach (var point in profile.Points)
            {
                // Independent projected linear-plane height at the geodesic sample, not nearest-pixel height.
                var sample = LolaHorizonService.Destination(location,point.AzimuthDeg,80);
                var (sx,sy) = LunarProjection.ToProjected(sample.Latitude,sample.Longitude);
                double target = 101.125 + 2*sx/80 + 3*sy/80;
                double psi = 80/LunarProjection.MoonRadiusMeters;
                double rs = LunarProjection.MoonRadiusMeters+target;
                double expectedAngle = Math.Atan2(rs*Math.Cos(psi)-(LunarProjection.MoonRadiusMeters+expectedCenter),rs*Math.Sin(psi))*180/Math.PI;
                Assert.InRange(Math.Abs(point.ElevationDeg-expectedAngle),0,0.000051);
            }
            // An exact native center retains the source Float32 value, with no centimeter rounding.
            var (nx,ny) = LunarProjection.FromPixel(3800,3800,terrain.Metadata);
            var nativeLocation = LunarProjection.ToGeographic(nx,ny);
            Assert.Equal(101.125,(await terrain.GetElevationAsync(new(nativeLocation.Latitude,nativeLocation.Longitude))).ElevationM);
        }
        finally { File.Delete(path); }
    }

    private static string WriteLinearSlopeTiff()
    {
        var raw = new byte[512*512*4];
        for (int r=0; r<512; r++)
            for (int c=0; c<512; c++)
                BitConverter.GetBytes(101.125f+2*(3584+c-3800)-3*(3584+r-3800)).CopyTo(raw,(r*512+c)*4);
        using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed,CompressionLevel.Fastest,true)) zlib.Write(raw);
        byte[] payload = compressed.ToArray();
        const int n=12, offsetTable=16+8+n*20+8, countTable=offsetTable+225*8, data=countTable+225*4;
        string path = Path.Combine(Path.GetTempPath(),Guid.NewGuid()+".tif");
        using var file = File.Create(path);
        using var writer = new BinaryWriter(file);
        writer.Write((ushort)0x4949);writer.Write((ushort)43);writer.Write((ushort)8);writer.Write((ushort)0);writer.Write(16ul);
        writer.Write((ulong)n);
        void Tag(ushort tag,ushort type,ulong count,ulong value) { writer.Write(tag);writer.Write(type);writer.Write(count);writer.Write(value); }
        Tag(256,4,1,7600);Tag(257,4,1,7600);Tag(258,3,1,32);Tag(259,3,1,8);Tag(277,3,1,1);Tag(284,3,1,1);
        Tag(317,3,1,1);Tag(322,4,1,512);Tag(323,4,1,512);Tag(324,16,225,offsetTable);Tag(325,4,225,countTable);Tag(339,3,1,3);
        writer.Write(0ul);
        for (int i=0; i<225; i++) writer.Write(i==112 ? (ulong)data : 0ul);
        for (int i=0; i<225; i++) writer.Write(i==112 ? (uint)payload.Length : 0u);
        writer.Write(payload);
        return path;
    }
}
