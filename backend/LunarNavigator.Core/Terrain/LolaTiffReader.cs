using System.Buffers;
using System.Collections.Concurrent;
using System.IO.Compression;
using Microsoft.Win32.SafeHandles;

namespace LunarNavigator.Core.Terrain;

/// <summary>
/// High-performance, thread-safe reader for Cloud-Optimized BigTIFF (COG) elevation models (DATA-01).
/// Reads individual 512x512 tiles on-demand using zero-copy positional I/O (RandomAccess)
/// and maintains an in-memory LRU tile cache to eliminate redundant disk I/O.
/// </summary>
public sealed class LolaTiffReader : IDisposable
{
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

    private LolaTiffReader(
        SafeFileHandle handle,
        LolaDemMetadata metadata,
        long[] tileOffsets,
        int[] tileByteCounts,
        int predictor = 3,
        int maxCachedTiles = 64)
    {
        this.fileHandle = handle;
        this.metadata = metadata;
        this.tileOffsets = tileOffsets;
        this.tileByteCounts = tileByteCounts;
        this.predictor = predictor;
        this.maxCachedTiles = maxCachedTiles;
    }

    /// <summary>
    /// Opens a LOLA BigTIFF file, parses its header and tile index.
    /// </summary>
    public static LolaTiffReader Open(string filePath, int maxCachedTiles = 64)
    {
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
        int width = 7600;
        int height = 7600;
        int tileWidth = 512;
        int tileHeight = 512;
        int predictor = 3;
        long[]? tileOffsets = null;
        int[]? tileByteCounts = null;

        if (isBigTiff)
        {
            Span<byte> countBuf = stackalloc byte[8];
            ReadExactly(handle, countBuf, ifdOffset);
            ulong numEntries = BitConverter.ToUInt64(countBuf);
            long entryOffset = ifdOffset + 8;

            Span<byte> entryBuf = stackalloc byte[20]; // BigTIFF tag is 20 bytes
            for (ulong i = 0; i < numEntries; i++)
            {
                ReadExactly(handle, entryBuf, entryOffset);
                ushort tag = BitConverter.ToUInt16(entryBuf[0..2]);
                ushort type = BitConverter.ToUInt16(entryBuf[2..4]);
                ulong count = BitConverter.ToUInt64(entryBuf[4..12]);
                long valOrOffset = BitConverter.ToInt64(entryBuf[12..20]);

                switch (tag)
                {
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

        int tilesAcross = (width + tileWidth - 1) / tileWidth;
        int tilesDown = (height + tileHeight - 1) / tileHeight;
        int totalTiles = tilesAcross * tilesDown;

        if (tileOffsets is null || tileByteCounts is null ||
            tileOffsets.Length != totalTiles || tileByteCounts.Length != totalTiles)
            throw new InvalidDataException("DEM tile index is missing or inconsistent.");
        long fileLength = RandomAccess.GetLength(handle);
        for (int i = 0; i < totalTiles; i++)
        {
            // TIFF sparse tiles have both offset and byte count zero.
            if (tileOffsets[i] == 0 && tileByteCounts[i] == 0) continue;
            if (tileOffsets[i] <= 0 || tileByteCounts[i] <= 0 ||
                tileOffsets[i] > fileLength - tileByteCounts[i])
                throw new InvalidDataException("DEM tile data extends beyond the available file; download may be incomplete.");
        }

        var meta = LolaDemMetadata.Default with
        {
            RasterWidth = width,
            RasterHeight = height,
            TileWidth = tileWidth,
            TileHeight = tileHeight
        };

        return new LolaTiffReader(handle, meta, tileOffsets, tileByteCounts, predictor, maxCachedTiles);
    }

    private static long[] ReadOffsetsArray(SafeFileHandle handle, long offset, int count, int type)
    {
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
        float[,] result = new float[windowHeight, windowWidth];
        for (int r = 0; r < windowHeight; r++)
        {
            int curRow = startRow + r;
            for (int c = 0; c < windowWidth; c++)
            {
                int curCol = startCol + c;
                result[r, c] = ReadPixel(curCol, curRow);
            }
        }
        return result;
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
                }

                // Decode samples using TIFF Predictor
                var floats = new float[metadata.TileWidth * metadata.TileHeight];
                DecodeSamples(uncompressed, floats, metadata.TileWidth, metadata.TileHeight, predictor);
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
            byte[] rowBuf = ArrayPool<byte>.Shared.Rent(rowBytes);
            try
            {
                for (int r = 0; r < height; r++)
                {
                    int rowOffset = r * rowBytes;
                    Buffer.BlockCopy(raw, rowOffset, rowBuf, 0, rowBytes);

                    // Undo horizontal differencing
                    for (int i = 1; i < rowBytes; i++)
                    {
                        rowBuf[i] = (byte)((rowBuf[i] + rowBuf[i - 1]) & 0xFF);
                    }

                    // Untangle byte planes (MSB to LSB in TIFF standard)
                    int destOffset = r * width;
                    for (int c = 0; c < width; c++)
                    {
                        byte b3 = rowBuf[(0 * width) + c]; // MSB
                        byte b2 = rowBuf[(1 * width) + c];
                        byte b1 = rowBuf[(2 * width) + c];
                        byte b0 = rowBuf[(3 * width) + c]; // LSB

                        // Reassemble IEEE 754 little-endian 32-bit float
                        uint u = (uint)((b3 << 24) | (b2 << 16) | (b1 << 8) | b0);
                        floats[destOffset + c] = BitConverter.UInt32BitsToSingle(u);
                    }
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(rowBuf);
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
