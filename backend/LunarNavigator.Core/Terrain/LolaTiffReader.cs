using System.Buffers;
using System.Collections.Concurrent;
using System.IO.Compression;
using System.Globalization;
using System.Text;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

namespace LunarNavigator.Core.Terrain;

/// <summary>
/// High-performance, thread-safe reader for Cloud-Optimized BigTIFF (COG) elevation models (DATA-01).
/// Reads individual 512x512 tiles on-demand using zero-copy positional I/O (RandomAccess)
/// and maintains an in-memory LRU tile cache to eliminate redundant disk I/O.
/// </summary>
public sealed class LolaTiffReader : IDisposable
{
    // Bound every allocation derived from untrusted TIFF metadata before renting/allocating.
    private const int MaxTiles = 1_000_000;
    private const int MaxTileBytes = 16 * 1024 * 1024;
    private const int MaxWindowPixels = 4_000_000;
    private readonly object decodeLock = new();
    private readonly SafeFileHandle fileHandle;
    private readonly LolaDemMetadata metadata;
    private readonly long[] tileOffsets;
    private readonly int[] tileByteCounts;
    private readonly int predictor;
    private readonly ConcurrentDictionary<int, float[]> tileCache = new();
    private readonly int maxCachedTiles;
    private readonly ConcurrentQueue<int> cacheEvictionQueue = new();
    private bool disposed;

    public LolaDemMetadata Metadata => metadata;
    public bool HasReviewedDatumAlignment { get; }
    public const string ReviewedDemSha256 = "82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a";
    public const string DatumReviewId = "PR15-BARKER2023-LDEM80S80-2026-11-15";

    private LolaTiffReader(
        SafeFileHandle handle,
        LolaDemMetadata metadata,
        long[] tileOffsets,
        int[] tileByteCounts,
        int predictor = 3,
        int maxCachedTiles = 64,
        bool reviewedDatumAlignment = false)
    {
        HasReviewedDatumAlignment = reviewedDatumAlignment;
        this.fileHandle = handle;
        this.metadata = metadata;
        this.tileOffsets = tileOffsets;
        this.tileByteCounts = tileByteCounts;
        this.predictor = predictor;
        this.maxCachedTiles = Math.Min(maxCachedTiles, 64 * 1024 * 1024 / checked(metadata.TileWidth * metadata.TileHeight * 4));
    }

    /// <summary>
    /// Opens a LOLA BigTIFF file, parses its header and tile index.
    /// </summary>
    public static LolaTiffReader Open(string filePath, int maxCachedTiles = 64)
    {
        if (maxCachedTiles is < 1 or > 64) throw new ArgumentOutOfRangeException(nameof(maxCachedTiles));
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException($"GeoTIFF file not found at: {filePath}", filePath);
        }

        var handle = File.OpenHandle(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        try
        {
            // Read first 16 bytes for TIFF/BigTIFF magic
            Span<byte> header = stackalloc byte[16];
            ReadExactly(handle, header, 0);

            bool isLittleEndian = header[0] == 0x49 && header[1] == 0x49; // 'II'
            if (!isLittleEndian)
            {
                throw new NotSupportedException("Only little-endian (II) BigTIFF files are currently supported.");
            }

            ushort magic = BitConverter.ToUInt16(header[2..4]);
            if (magic != 43 && magic != 42)
            {
                throw new InvalidDataException($"Unsupported TIFF magic value: {magic}. Expected 43 (BigTIFF) or 42 (Classic TIFF).");
            }

            long ifdOffset;
            if (magic == 43)
            {
                if (BitConverter.ToUInt16(header[4..6]) != 8 || BitConverter.ToUInt16(header[6..8]) != 0)
                    throw new InvalidDataException("Invalid BigTIFF offset size or reserved field.");
                // BigTIFF header: bytes 8..16 is 64-bit IFD offset
                ifdOffset = BitConverter.ToInt64(header[8..16]);
            }
            else
            {
                // Classic TIFF: bytes 4..8 is 32-bit IFD offset
                ifdOffset = BitConverter.ToUInt32(header[4..8]);
            }

            // Parse IFD
            return ParseIfd(handle, ifdOffset, magic == 43, maxCachedTiles);
        }
        catch
        {
            handle.Dispose();
            throw;
        }
    }

    private static void ReadExactly(SafeFileHandle handle, Span<byte> buffer, long offset)
    {
        if (offset < 0 || offset > RandomAccess.GetLength(handle) - buffer.Length)
            throw new InvalidDataException("DEM read exceeds the available file; download may be incomplete.");
        int total = 0;
        while (total < buffer.Length)
        {
            int read = RandomAccess.Read(handle, buffer[total..], offset + total);
            if (read == 0) throw new EndOfStreamException("DEM file ended before the requested data was read.");
            total += read;
        }
    }

    private static LolaTiffReader ParseIfd(SafeFileHandle handle, long ifdOffset, bool isBigTiff, int maxCachedTiles)
    {
        int width = 0;
        int height = 0;
        int tileWidth = 0;
        int tileHeight = 0;
        int predictor = 1;
        float noData = float.NaN;
        bool pixelIsArea = false;
        int? bits = null, compression = null, samples = null, sampleFormat = null, planar = null;
        var geotags = new Dictionary<ushort, byte[]>();
        var seenTags = new HashSet<ushort>();
        long[]? tileOffsets = null;
        int[]? tileByteCounts = null;

        if (isBigTiff)
        {
            Span<byte> countBuf = stackalloc byte[8];
            ReadExactly(handle, countBuf, ifdOffset);
            ulong numEntries = BitConverter.ToUInt64(countBuf);
            if (numEntries > 4096 || numEntries > (ulong)((RandomAccess.GetLength(handle) - ifdOffset - 8) / 20))
                throw new InvalidDataException("DEM IFD entry count exceeds supported limits or file bounds.");
            long entryOffset = ifdOffset + 8;

            Span<byte> entryBuf = stackalloc byte[20]; // BigTIFF tag is 20 bytes
            for (ulong i = 0; i < numEntries; i++)
            {
                ReadExactly(handle, entryBuf, entryOffset);
                ushort tag = BitConverter.ToUInt16(entryBuf[0..2]);
                ushort type = BitConverter.ToUInt16(entryBuf[2..4]);
                ulong count = BitConverter.ToUInt64(entryBuf[4..12]);
                long valOrOffset = BitConverter.ToInt64(entryBuf[12..20]);

                if (!seenTags.Add(tag)) throw new InvalidDataException("Duplicate DEM TIFF tag.");
                if (tag is 33550 or 33922 or 34735 or 34736 or 34737)
                {
                    int size = type switch { 2 => 1, 3 => 2, 12 => 8, _ => 0 };
                    if (size == 0 || count > 16384) throw new InvalidDataException("Unsupported DEM geotag encoding.");
                    var raw = new byte[checked((int)count * size)];
                    if (raw.Length <= 8) entryBuf[12..(12 + raw.Length)].CopyTo(raw);
                    else ReadExactly(handle, raw, valOrOffset);
                    geotags.Add(tag, raw);
                }
                if (count > MaxTiles) throw new InvalidDataException("DEM tag count exceeds supported limits.");
                if (tag is 256 or 257 or 258 or 259 or 277 or 284 or 317 or 322 or 323 or 339 && (count != 1 || valOrOffset < 0 || valOrOffset > int.MaxValue))
                    throw new InvalidDataException("Invalid DEM scalar tag.");
                switch (tag)
                {
                    case 42113:
                        if (type != 2 || count is < 1 or > 128)
                            throw new InvalidDataException("Invalid DEM NoData tag.");
                        var noDataBytes = new byte[(int)count];
                        if (count <= 8) BitConverter.GetBytes(valOrOffset).AsSpan(0, (int)count).CopyTo(noDataBytes);
                        else ReadExactly(handle, noDataBytes, valOrOffset);
                        string noDataText = Encoding.ASCII.GetString(noDataBytes).TrimEnd('\0');
                        if (noDataText.Equals("nan", StringComparison.OrdinalIgnoreCase)) noData = float.NaN;
                        else if (!float.TryParse(noDataText, NumberStyles.Float, CultureInfo.InvariantCulture, out noData) || !float.IsFinite(noData))
                            throw new InvalidDataException("Unsupported DEM NoData value.");
                        break;
                    case 34735:
                        if (type != 3 || count < 4 || count > 16384)
                            throw new InvalidDataException("Invalid DEM GeoKey directory.");
                        var keys = new byte[(int)count * 2];
                        ReadExactly(handle, keys, valOrOffset);
                        int keyCount = BitConverter.ToUInt16(keys, 6);
                        if (4L + keyCount * 4L != (long)count)
                            throw new InvalidDataException("Inconsistent DEM GeoKey directory.");
                        for (int k = 0; k < keyCount; k++)
                        {
                            int key = 8 + k * 8;
                            if (BitConverter.ToUInt16(keys, key) == 1025)
                            {
                                if (BitConverter.ToUInt16(keys, key + 2) != 0 || BitConverter.ToUInt16(keys, key + 4) != 1)
                                    throw new InvalidDataException("Invalid DEM raster type GeoKey.");
                                int rasterType = BitConverter.ToUInt16(keys, key + 6);
                                if (rasterType is not (1 or 2)) throw new InvalidDataException("Unsupported DEM raster type.");
                                pixelIsArea = rasterType == 1;
                            }
                        }
                        break;
                    case 258: bits = (int)valOrOffset; break;
                    case 259: compression = (int)valOrOffset; break;
                    case 277: samples = (int)valOrOffset; break;
                    case 284: planar = (int)valOrOffset; break;
                    case 339: sampleFormat = (int)valOrOffset; break;
                    case 256: // ImageWidth
                        width = (int)valOrOffset;
                        break;
                    case 257: // ImageLength
                        height = (int)valOrOffset;
                        break;
                    case 317: // Predictor
                        predictor = (int)valOrOffset;
                        break;
                    case 322: // TileWidth
                        tileWidth = (int)valOrOffset;
                        break;
                    case 323: // TileLength
                        tileHeight = (int)valOrOffset;
                        break;
                    case 324: // TileOffsets
                        tileOffsets = count == 1
                            ? new long[] { valOrOffset }
                            : ReadOffsetsArray(handle, valOrOffset, (int)count, type);
                        break;
                    case 325: // TileByteCounts
                        tileByteCounts = count == 1
                            ? new int[] { (int)valOrOffset }
                            : ReadCountsArray(handle, valOrOffset, (int)count, type);
                        break;
                }
                entryOffset += 20;
            }
        }

        if (!isBigTiff) throw new NotSupportedException("Only tiled BigTIFF DEM files are supported.");
        if (width <= 0 || height <= 0 || tileWidth <= 0 || tileHeight <= 0)
            throw new InvalidDataException("Invalid DEM raster dimensions.");
        if ((long)tileWidth * tileHeight * 4 > MaxTileBytes || width > 1_000_000 || height > 1_000_000)
            throw new InvalidDataException("DEM raster or tile dimensions exceed supported limits.");
        if (bits != 32 || compression is not (8 or 32946) || samples is not (null or 1) || sampleFormat != 3 || planar is not (null or 1))
            throw new InvalidDataException("DEM must contain single-band Float32 Deflate samples with contiguous planar layout.");
        if (predictor is not (1 or 3)) throw new InvalidDataException("Unsupported DEM predictor.");

        int tilesAcross = (width + tileWidth - 1) / tileWidth;
        int tilesDown = (height + tileHeight - 1) / tileHeight;
        long tileCount = (long)tilesAcross * tilesDown;
        if (tileCount > MaxTiles) throw new InvalidDataException("DEM tile count exceeds supported limits.");
        int totalTiles = (int)tileCount;

        if (tileOffsets is null || tileByteCounts is null ||
            tileOffsets.Length != totalTiles || tileByteCounts.Length != totalTiles)
            throw new InvalidDataException("DEM tile index is missing or inconsistent.");
        long fileLength = RandomAccess.GetLength(handle);
        for (int i = 0; i < totalTiles; i++)
        {
            // TIFF sparse tiles have both offset and byte count zero.
            if (tileOffsets[i] == 0 && tileByteCounts[i] == 0) continue;
            if (tileOffsets[i] <= 0 || tileByteCounts[i] <= 0 || tileByteCounts[i] > MaxTileBytes ||
                tileOffsets[i] > fileLength - tileByteCounts[i])
                throw new InvalidDataException("DEM tile data extends beyond the available file; download may be incomplete.");
        }

        var meta = LolaDemMetadata.Default with
        {
            NoDataValue = noData,
            RasterPixelIsArea = pixelIsArea,
            RasterWidth = width,
            RasterHeight = height,
            TileWidth = tileWidth,
            TileHeight = tileHeight
        };

        bool reviewed = width == 7600 && height == 7600 && tileWidth == 512 && tileHeight == 512 &&
            predictor == 3 && pixelIsArea && float.IsNaN(noData) &&
            ReviewedGeotagsMatch(geotags) && ReviewedIdentityMatches(handle);
        return new LolaTiffReader(handle, meta, tileOffsets, tileByteCounts, predictor, maxCachedTiles, reviewed);
    }

    private static bool ReviewedGeotagsMatch(IReadOnlyDictionary<ushort, byte[]> tags)
    {
        // Exact native geotags of the reviewed product, not defaults inferred from a filename.
        bool Doubles(ushort tag, double[] expected) => tags.TryGetValue(tag, out var raw) &&
            raw.Length == expected.Length * 8 && expected.Select((v, i) => BitConverter.ToDouble(raw, i * 8) == v).All(v => v);
        ushort[] keys = [1,1,0,20,1024,0,1,1,1025,0,1,1,1026,34737,46,0,2048,0,1,32767,
            2049,34737,134,46,2050,0,1,32767,2054,0,1,9102,2056,0,1,32767,2057,34736,1,5,
            2058,34736,1,6,2061,34736,1,7,3072,0,1,32767,3074,0,1,32767,3075,0,1,15,
            3076,0,1,9001,3081,34736,1,0,3082,34736,1,3,3083,34736,1,4,3092,34736,1,2,3095,34736,1,1];
        return Doubles(33550, [80,80,0]) && Doubles(33922, [0,0,0,-304000,304000,0]) &&
            Doubles(34736, [-90,0,1,0,0,1737400,1737400,0]) &&
            tags.TryGetValue(34735, out var directory) && directory.Length == keys.Length * 2 &&
            keys.Select((v,i) => BitConverter.ToUInt16(directory, i * 2) == v).All(v => v) &&
            tags.TryGetValue(34737, out var text) && Encoding.ASCII.GetString(text).TrimEnd('\0') ==
            "Moon (2015) - Sphere / Ocentric / South Polar|GCS Name = Moon (2015) - Sphere / Ocentric|Datum = Moon (2015) - Sphere|Ellipsoid = Moon (2015) - Sphere|Primem = Reference Meridian||";
    }

    private static bool ReviewedIdentityMatches(SafeFileHandle handle)
    {
        const long length = 189158392;
        if (RandomAccess.GetLength(handle) != length) return false;
        // Hash the SAME opened handle that supplies pixels, not a separately reopened pathname.
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        byte[] buffer = ArrayPool<byte>.Shared.Rent(128 * 1024);
        try
        {
            for (long offset = 0; offset < length;)
            {
                int count = (int)Math.Min(buffer.Length, length - offset);
                ReadExactly(handle, buffer.AsSpan(0, count), offset);
                hash.AppendData(buffer, 0, count);
                offset += count;
            }
            return Convert.ToHexString(hash.GetHashAndReset()).Equals(ReviewedDemSha256, StringComparison.OrdinalIgnoreCase);
        }
        finally { ArrayPool<byte>.Shared.Return(buffer); }
    }

    private static long[] ReadOffsetsArray(SafeFileHandle handle, long offset, int count, int type)
    {
        if (count < 1 || count > MaxTiles || type is not (16 or 4))
            throw new InvalidDataException("Invalid DEM tile offset array.");
        var result = new long[count];
        if (type == 16) // TIFF_LONG8 (8 bytes)
        {
            byte[] buf = new byte[count * 8];
            ReadExactly(handle, buf, offset);
            for (int i = 0; i < count; i++)
            {
                result[i] = BitConverter.ToInt64(buf, i * 8);
            }
        }
        else if (type == 4) // TIFF_LONG (4 bytes)
        {
            byte[] buf = new byte[count * 4];
            ReadExactly(handle, buf, offset);
            for (int i = 0; i < count; i++)
            {
                result[i] = BitConverter.ToUInt32(buf, i * 4);
            }
        }
        return result;
    }

    private static int[] ReadCountsArray(SafeFileHandle handle, long offset, int count, int type)
    {
        if (count < 1 || count > MaxTiles || type is not (4 or 3))
            throw new InvalidDataException("Invalid DEM tile byte count array.");
        var result = new int[count];
        if (type == 4 || type == 3) // TIFF_LONG or SHORT
        {
            int size = type == 4 ? 4 : 2;
            byte[] buf = new byte[count * size];
            ReadExactly(handle, buf, offset);
            for (int i = 0; i < count; i++)
            {
                result[i] = size == 4 ? BitConverter.ToInt32(buf, i * 4) : BitConverter.ToUInt16(buf, i * 2);
            }
        }
        return result;
    }

    /// <summary>
    /// Reads the elevation value (meters) at specific raster pixel coordinates (col, row).
    /// </summary>
    public float ReadPixel(int col, int row)
    {
        if (!metadata.ContainsPixel(col, row))
        {
            return float.NaN;
        }

        int tileX = col / metadata.TileWidth;
        int tileY = row / metadata.TileHeight;
        int tileIndex = (tileY * metadata.TilesAcross) + tileX;

        float[] tileData = GetTile(tileIndex);
        int localCol = col % metadata.TileWidth;
        int localRow = row % metadata.TileHeight;
        int pixelIndex = (localRow * metadata.TileWidth) + localCol;

        return tileData[pixelIndex];
    }

    /// <summary>
    /// Reads a 2D window of elevation values starting at (startCol, startRow).
    /// </summary>
    public float[,] ReadWindow(int startCol, int startRow, int windowWidth, int windowHeight)
    {
        if (windowWidth <= 0 || windowHeight <= 0 || (long)windowWidth * windowHeight > MaxWindowPixels)
            throw new ArgumentOutOfRangeException(nameof(windowWidth), "DEM window exceeds supported limits.");

        float[] flat = ArrayPool<float>.Shared.Rent(windowWidth * windowHeight);
        try
        {
            ReadWindowFlat(startCol, startRow, windowWidth, windowHeight, flat.AsSpan(0, windowWidth * windowHeight));
            float[,] result = new float[windowHeight, windowWidth];
            for (int r = 0; r < windowHeight; r++)
                flat.AsSpan(r * windowWidth, windowWidth).CopyTo(System.Runtime.InteropServices.MemoryMarshal.CreateSpan(ref result[r, 0], windowWidth));
            return result;
        }
        finally
        {
            ArrayPool<float>.Shared.Return(flat);
        }
    }

    /// <summary>
    /// Reads a row-major 2D window of elevation values tile-by-tile into <paramref name="destination"/>.
    /// </summary>
    public void ReadWindowFlat(int startCol, int startRow, int windowWidth, int windowHeight, Span<float> destination)
    {
        if (windowWidth <= 0 || windowHeight <= 0 || (long)windowWidth * windowHeight > MaxWindowPixels)
            throw new ArgumentOutOfRangeException(nameof(windowWidth), "DEM window exceeds supported limits.");
        int totalPixels = windowWidth * windowHeight;
        if (destination.Length < totalPixels)
            throw new ArgumentException("Destination span is smaller than the requested window.", nameof(destination));

        var dst = destination[..totalPixels];
        int validColStart = Math.Max(0, startCol);
        int validColEnd = Math.Min(metadata.RasterWidth, startCol + windowWidth);
        int validRowStart = Math.Max(0, startRow);
        int validRowEnd = Math.Min(metadata.RasterHeight, startRow + windowHeight);

        if (validColStart >= validColEnd || validRowStart >= validRowEnd)
        {
            dst.Fill(float.NaN);
            return;
        }

        if (validColStart != startCol || validColEnd != startCol + windowWidth
            || validRowStart != startRow || validRowEnd != startRow + windowHeight)
        {
            dst.Fill(float.NaN);
        }

        int tileWidth = metadata.TileWidth;
        int tileHeight = metadata.TileHeight;
        int tileStartY = validRowStart / tileHeight;
        int tileEndY = (validRowEnd - 1) / tileHeight;
        int tileStartX = validColStart / tileWidth;
        int tileEndX = (validColEnd - 1) / tileWidth;

        for (int tileY = tileStartY; tileY <= tileEndY; tileY++)
        {
            int tileOriginRow = tileY * tileHeight;
            int rowMin = Math.Max(validRowStart, tileOriginRow);
            int rowMax = Math.Min(validRowEnd, tileOriginRow + tileHeight);
            int tileRowBase = tileY * metadata.TilesAcross;

            for (int tileX = tileStartX; tileX <= tileEndX; tileX++)
            {
                float[] tileData = GetTile(tileRowBase + tileX);
                int tileOriginCol = tileX * tileWidth;
                int colMin = Math.Max(validColStart, tileOriginCol);
                int colMax = Math.Min(validColEnd, tileOriginCol + tileWidth);
                int copyWidth = colMax - colMin;
                int localColStart = colMin - tileOriginCol;
                int dstColOffset = colMin - startCol;

                for (int r = rowMin; r < rowMax; r++)
                {
                    int srcIndex = ((r - tileOriginRow) * tileWidth) + localColStart;
                    int dstIndex = ((r - startRow) * windowWidth) + dstColOffset;
                    tileData.AsSpan(srcIndex, copyWidth).CopyTo(dst.Slice(dstIndex, copyWidth));
                }
            }
        }
    }

    /// <summary>
    /// Retrieves a decoded 512x512 tile from cache or reads and decodes it from disk.
    /// </summary>
    public float[] GetTile(int tileIndex)
    {
        if (disposed)
        {
            throw new ObjectDisposedException(nameof(LolaTiffReader));
        }

        if (tileCache.TryGetValue(tileIndex, out var cached))
        {
            return cached;
        }

        lock (decodeLock)
        {
            if (tileCache.TryGetValue(tileIndex, out cached)) return cached;
            float[] decoded = DecodeTile(tileIndex);

            // Add to LRU cache
            if (tileCache.TryAdd(tileIndex, decoded))
            {
                cacheEvictionQueue.Enqueue(tileIndex);
                if (tileCache.Count > maxCachedTiles && cacheEvictionQueue.TryDequeue(out int evictId))
                {
                    tileCache.TryRemove(evictId, out _);
                }
            }

            return decoded;
        }
    }

    private float[] DecodeTile(int tileIndex)
    {
        long offset = tileOffsets[tileIndex];
        int byteCount = tileByteCounts[tileIndex];

        if (offset == 0 || byteCount <= 0)
        {
            // Unallocated tile: all NoData
            var empty = new float[metadata.TileWidth * metadata.TileHeight];
            Array.Fill(empty, float.NaN);
            return empty;
        }

        byte[] compressed = ArrayPool<byte>.Shared.Rent(byteCount);
        try
        {
            ReadExactly(fileHandle, compressed.AsSpan(0, byteCount), offset);

            // Decompress ZLib / Deflate
            int uncompressedSize = metadata.TileWidth * metadata.TileHeight * 4;
            byte[] uncompressed = ArrayPool<byte>.Shared.Rent(uncompressedSize);
            try
            {
                using (var memStream = new MemoryStream(compressed, 0, byteCount, false))
                using (var zlib = new ZLibStream(memStream, CompressionMode.Decompress))
                {
                    zlib.ReadExactly(uncompressed.AsSpan(0, uncompressedSize));
                    if (zlib.ReadByte() != -1) throw new InvalidDataException("DEM tile exceeds declared dimensions.");
                }

                // Decode samples using TIFF Predictor
                var floats = new float[metadata.TileWidth * metadata.TileHeight];
                DecodeSamples(uncompressed, floats, metadata.TileWidth, metadata.TileHeight, predictor);
                for (int i = 0; i < floats.Length; i++)
                    if (!float.IsFinite(floats[i]) || floats[i] == metadata.NoDataValue) floats[i] = float.NaN;
                return floats;
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(uncompressed);
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(compressed);
        }
    }

    private static void DecodeSamples(byte[] raw, float[] floats, int width, int height, int predictor)
    {
        int rowBytes = width * 4;

        if (predictor == 3) // Floating Point Predictor (TIFF Tech Note 3)
        {
            for (int r = 0; r < height; r++)
            {
                Span<byte> rowSpan = raw.AsSpan(r * rowBytes, rowBytes);

                // Undo horizontal differencing in-place inside the temporary decompressed buffer
                for (int i = 1; i < rowBytes; i++)
                {
                    rowSpan[i] = (byte)(rowSpan[i] + rowSpan[i - 1]);
                }

                // Untangle byte planes (MSB to LSB in TIFF standard)
                int destOffset = r * width;
                for (int c = 0; c < width; c++)
                {
                    byte b3 = rowSpan[c]; // MSB
                    byte b2 = rowSpan[width + c];
                    byte b1 = rowSpan[(2 * width) + c];
                    byte b0 = rowSpan[(3 * width) + c]; // LSB

                    // Reassemble IEEE 754 little-endian 32-bit float
                    uint u = (uint)((b3 << 24) | (b2 << 16) | (b1 << 8) | b0);
                    floats[destOffset + c] = BitConverter.UInt32BitsToSingle(u);
                }
            }
        }
        else // Predictor == 1 (No predictor / straight bytes)
        {
            Buffer.BlockCopy(raw, 0, floats, 0, floats.Length * 4);
        }
    }

    public void Dispose()
    {
        if (!disposed)
        {
            disposed = true;
            fileHandle.Dispose();
            tileCache.Clear();
        }
    }
}
