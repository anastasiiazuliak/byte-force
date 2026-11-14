using System.Text.Json;
using Xunit;

namespace LunarNavigator.Core.Tests.Terrain;

public class P2DataPipelinesTests
{
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
        throw new DirectoryNotFoundException("Could not locate repository root.");
    }

    [Fact]
    public void IlluminationManifest_HasMultipleRealTimestamps_AndProvenance()
    {
        string root = FindRepoRoot();
        string path = Path.Combine(root, "public-assets", "illumination", "illumination-manifest.json");
        Assert.True(File.Exists(path), $"Illumination manifest missing: {path}");

        using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement r = doc.RootElement;

        Assert.Equal("P2-01", r.GetProperty("task").GetString());
        Assert.Equal("LDEM_80S_80MPP_ADJ.TIF", r.GetProperty("sourceDataset").GetString());
        Assert.Contains("1737400", r.GetProperty("verticalReference").GetString());

        JsonElement timestamps = r.GetProperty("timestamps");
        Assert.True(timestamps.GetArrayLength() >= 2, "Expected at least 2 timestamp masks.");

        foreach (JsonElement ts in timestamps.EnumerateArray())
        {
            double lit = ts.GetProperty("litFraction").GetDouble();
            double shadow = ts.GetProperty("shadowFraction").GetDouble();
            double noData = ts.GetProperty("noDataFraction").GetDouble();
            Assert.InRange(lit + shadow + noData, 0.99, 1.01);
            Assert.True(lit > 0.0 && shadow > 0.0, "Real Connecting Ridge mask must contain both sunlit and shadowed terrain.");
            Assert.Contains("{z}/{x}/{y}.webp", ts.GetProperty("tileTemplate").GetString());
        }
    }

    [Fact]
    public void HighResManifest_AlignsVerticalDatumWithBaseLodTileset_AndSupportsSafeDisable()
    {
        string root = FindRepoRoot();
        string basePath = Path.Combine(root, "public-assets", "metadata", "lod-tileset.json");
        string highResPath = Path.Combine(root, "public-assets", "metadata", "highres-manifest.json");

        Assert.True(File.Exists(basePath), $"Base LOD tileset missing: {basePath}");
        Assert.True(File.Exists(highResPath), $"High-res manifest missing: {highResPath}");

        using JsonDocument baseDoc = JsonDocument.Parse(File.ReadAllText(basePath));
        using JsonDocument hrDoc = JsonDocument.Parse(File.ReadAllText(highResPath));

        JsonElement b = baseDoc.RootElement;
        JsonElement hr = hrDoc.RootElement;

        Assert.Equal("P2-03", hr.GetProperty("task").GetString());
        Assert.True(hr.GetProperty("optional").GetBoolean());
        Assert.Equal(5.0, hr.GetProperty("resolutionMeters").GetDouble());
        Assert.True(hr.GetProperty("verticalDatumNormalizedToBase").GetBoolean());

        // Exact datum & local origin alignment prevents vertical jump during LOD switch
        double baseRefElev = b.GetProperty("referenceElevationMeters").GetDouble();
        double hrRefElev = hr.GetProperty("baseReferenceElevationMeters").GetDouble();
        Assert.Equal(baseRefElev, hrRefElev, precision: 6);

        double baseOriginX = b.GetProperty("meshLocalOrigin")[0].GetDouble();
        double baseOriginY = b.GetProperty("meshLocalOrigin")[1].GetDouble();
        double hrOriginX = hr.GetProperty("baseMeshLocalOrigin")[0].GetDouble();
        double hrOriginY = hr.GetProperty("baseMeshLocalOrigin")[1].GetDouble();
        Assert.Equal(baseOriginX, hrOriginX, precision: 6);
        Assert.Equal(baseOriginY, hrOriginY, precision: 6);

        Assert.False(hr.GetProperty("coverage").GetProperty("fullSouthPoleCoverage").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(hr.GetProperty("horizonDisclaimer").GetString()));
    }
}
