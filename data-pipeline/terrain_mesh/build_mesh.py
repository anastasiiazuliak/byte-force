#!/usr/bin/env python3
"""
Offline NASA LOLA DEM → 3D GLB terrain mesh pipeline.

Reads a window from the LOLA South-Polar DEM (BigTIFF / GeoTIFF, Float32,
80 m/px, South Polar Stereographic, R=1737400 m) and writes a binary glTF 2.0
(GLB) mesh file plus a JSON manifest.

Requires only Python 3.8+ stdlib — no GDAL, numpy, or pip packages.

Usage examples
--------------
  # dry-run / help
  python build_mesh.py --help
  python build_mesh.py --dry-run

  # local DEM file (e.g. downloaded via data/scripts/download_data.py)
  python build_mesh.py \\
      --source-file data/raw/LDEM_80S_80MPP_ADJ.TIF \\
      --lat -89.45 --lon -137.31 \\
      --radius-km 5 \\
      --output public-assets/terrain/0/0/0.glb \\
      --manifest public-assets/metadata/terrain-manifest.json

  # HTTP Range-request mode (no local DEM needed; slower)
  python build_mesh.py \\
      --source-url https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF \\
      --lat -89.45 --lon -137.31 \\
      --radius-km 5 \\
      --output public-assets/terrain/0/0/0.glb \\
      --manifest public-assets/metadata/terrain-manifest.json
"""

from __future__ import annotations

import argparse
import json
import math
import os
import struct
import sys
import urllib.request
import zlib
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Constants matching the canonical lunar terrain contract
# ---------------------------------------------------------------------------
MOON_RADIUS_M: float = 1_737_400.0
# LOLA DEM header values (verified from real file)
DEM_PIXEL_SCALE_M: float = 80.0          # metres per pixel
DEM_COLS: int = 7600
DEM_ROWS: int = 7600
DEM_ORIGIN_X_M: float = -304_000.0       # ModelTiepoint[3]  — X of pixel (0,0)
DEM_ORIGIN_Y_M: float =  304_000.0       # ModelTiepoint[4]  — Y of pixel (0,0)
DEM_NODATA: float = float("nan")
# Attribution
ATTRIBUTION = "NASA GSFC PGDA / Barker et al. 2023"
SOURCE_DATASET = "LDEM_80S_80MPP_ADJ.TIF"
VERTICAL_REFERENCE = "Moon (2015) Sphere R=1737400m"


# ---------------------------------------------------------------------------
# Projection helpers (South Polar Stereographic)
# ---------------------------------------------------------------------------

def latlon_to_proj(lat_deg: float, lon_deg: float) -> tuple[float, float]:
    """Geographic → South Polar Stereographic (metres)."""
    colat_deg = 90.0 + lat_deg          # 0 at pole
    colat_rad = math.radians(colat_deg)
    rho = 2.0 * MOON_RADIUS_M * math.tan(colat_rad / 2.0)
    lon_rad = math.radians(lon_deg)
    x = rho * math.sin(lon_rad)
    y = rho * math.cos(lon_rad)
    return x, y


def proj_to_latlon(x_m: float, y_m: float) -> tuple[float, float]:
    """South Polar Stereographic (metres) → Geographic."""
    rho = math.hypot(x_m, y_m)
    if rho < 1e-6:
        return -90.0, 0.0
    colat_rad = 2.0 * math.atan2(rho, 2.0 * MOON_RADIUS_M)
    lat_deg = math.degrees(colat_rad) - 90.0
    lon_deg = math.degrees(math.atan2(x_m, y_m))
    return lat_deg, lon_deg


def proj_to_pixel(x_m: float, y_m: float) -> tuple[float, float]:
    """Projected metres → fractional pixel column, row."""
    col = (x_m - DEM_ORIGIN_X_M) / DEM_PIXEL_SCALE_M
    row = (DEM_ORIGIN_Y_M - y_m) / DEM_PIXEL_SCALE_M   # Y axis flipped
    return col, row


def pixel_to_proj(col: float, row: float) -> tuple[float, float]:
    """Pixel (col, row) → projected metres."""
    x = DEM_ORIGIN_X_M + col * DEM_PIXEL_SCALE_M
    y = DEM_ORIGIN_Y_M - row * DEM_PIXEL_SCALE_M
    return x, y


# ---------------------------------------------------------------------------
# Minimal BigTIFF reader (stdlib only, same approach as LolaTiffReader.cs)
# ---------------------------------------------------------------------------

class BigTiffReader:
    """Read Float32 elevation samples from a BigTIFF/GeoTIFF without GDAL."""

    def __init__(self, source: "str | Path", source_url: Optional[str] = None):
        self._path = str(source) if source else None
        self._url = source_url
        self._fp = None
        self._little_endian = True
        self._bigtiff = False
        self._ifd_offset = 0
        self._cols = 0
        self._rows = 0
        self._tile_width = 0
        self._tile_height = 0
        self._tiled = False
        self._strip_offsets: list[int] = []
        self._strip_byte_counts: list[int] = []
        self._tile_offsets: list[int] = []
        self._tile_byte_counts: list[int] = []
        self._compression = 1   # 1=none, 5=LZW, 8=zlib/deflate
        self._predictor = 1
        self._sample_format = 3  # 3=float
        self._bits_per_sample = 32
        self.tags = {}
        self._remote_identity = None

    # --- open / close -------------------------------------------------------

    def open(self):
        if self._path:
            self._fp = open(self._path, "rb")
        self._parse_header()

    def close(self):
        if self._fp:
            self._fp.close()
            self._fp = None

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, *_):
        self.close()

    # --- internal helpers ---------------------------------------------------

    def _read_bytes(self, offset: int, length: int) -> bytes:
        if self._fp:
            self._fp.seek(offset)
            return self._fp.read(length)
        # HTTP Range request
        req = urllib.request.Request(
            self._url,
            headers={
                "Range": f"bytes={offset}-{offset + length - 1}",
                "User-Agent": "ByteForce-LunarNavigator/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            content_range = resp.headers.get('Content-Range', '')
            prefix = f'bytes {offset}-{offset + length - 1}/'
            identity = (resp.headers.get('ETag'), resp.headers.get('Last-Modified'), content_range.split('/')[-1])
            if resp.status != 206 or not content_range.startswith(prefix):
                raise ValueError('Remote TIFF did not honor exact byte range')
            if not any(identity[:2]) or (self._remote_identity and self._remote_identity != identity):
                raise ValueError('Remote TIFF identity missing or changed')
            self._remote_identity = identity
            raw = resp.read(length+1)
            if len(raw) != length or int(resp.headers.get('Content-Length', -1)) != length:
                raise ValueError('Truncated/oversized remote TIFF range')
            return raw

    def _u(self, fmt: str, data: bytes, off: int = 0):
        prefix = "<" if self._little_endian else ">"
        return struct.unpack_from(prefix + fmt, data, off)

    # --- header parsing -----------------------------------------------------

    def _parse_header(self):
        hdr = self._read_bytes(0, 16)
        byte_order = hdr[:2]
        self._little_endian = byte_order == b"II"
        magic = self._u("H", hdr, 2)[0]
        if magic == 43:
            self._bigtiff = True
            self._ifd_offset = self._u("Q", hdr, 8)[0]
        elif magic == 42:
            self._bigtiff = False
            self._ifd_offset = self._u("I", hdr, 4)[0]
        else:
            raise ValueError(f"Not a TIFF file (magic={magic})")
        self._parse_ifd(self._ifd_offset)

    def _read_value_or_ptr(self, tag: int, type_code: int, count: int,
                           val_or_offset_bytes: bytes) -> list:
        """Return the actual tag values, fetching from file if needed."""
        type_sizes = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1,
                      11: 4, 12: 8, 16: 8, 17: 8}
        type_fmts  = {1: "B", 2: "s", 3: "H", 4: "I", 5: "Q",
                      7: "B", 11: "f", 12: "d", 16: "Q", 17: "q"}
        sz = type_sizes.get(type_code, 1)
        fmt = type_fmts.get(type_code, "B")
        total = sz * count

        if self._bigtiff:
            inline_max = 8
        else:
            inline_max = 4

        if total <= inline_max:
            raw = val_or_offset_bytes[:total]
        else:
            # val_or_offset_bytes contains the file offset
            prefix = "<" if self._little_endian else ">"
            if self._bigtiff:
                offset = struct.unpack_from(prefix + "Q", val_or_offset_bytes)[0]
            else:
                offset = struct.unpack_from(prefix + "I", val_or_offset_bytes)[0]
            raw = self._read_bytes(offset, total)

        prefix = "<" if self._little_endian else ">"
        if type_code == 2:  # ASCII
            return [raw.rstrip(b"\x00").decode("ascii", errors="replace")]
        if fmt == "s":
            return list(raw)
        return list(struct.unpack_from(prefix + fmt * count, raw))

    def _parse_ifd(self, ifd_offset: int):
        prefix = "<" if self._little_endian else ">"
        if self._bigtiff:
            cnt_raw = self._read_bytes(ifd_offset, 8)
            n_entries = struct.unpack_from(prefix + "Q", cnt_raw)[0]
            entry_size = 20       # tag(2)+type(2)+count(8)+val(8)
            entries_raw = self._read_bytes(ifd_offset + 8, n_entries * entry_size)
        else:
            cnt_raw = self._read_bytes(ifd_offset, 2)
            n_entries = struct.unpack_from(prefix + "H", cnt_raw)[0]
            entry_size = 12       # tag(2)+type(2)+count(4)+val(4)
            entries_raw = self._read_bytes(ifd_offset + 2, n_entries * entry_size)

        def get_entry(i: int):
            base = i * entry_size
            if self._bigtiff:
                tag, type_code = struct.unpack_from(prefix + "HH", entries_raw, base)
                count = struct.unpack_from(prefix + "Q", entries_raw, base + 4)[0]
                vob = entries_raw[base + 12: base + 20]
            else:
                tag, type_code = struct.unpack_from(prefix + "HH", entries_raw, base)
                count = struct.unpack_from(prefix + "I", entries_raw, base + 4)[0]
                vob = entries_raw[base + 8: base + 12]
            return tag, type_code, count, vob

        for i in range(n_entries):
            tag, tc, count, vob = get_entry(i)
            vals = self._read_value_or_ptr(tag, tc, count, vob)
            self.tags[tag] = vals

            if tag == 256:    # ImageWidth
                self._cols = int(vals[0])
            elif tag == 257:  # ImageLength
                self._rows = int(vals[0])
            elif tag == 258:  # BitsPerSample
                self._bits_per_sample = int(vals[0])
            elif tag == 259:  # Compression
                self._compression = int(vals[0])
            elif tag == 278:  # RowsPerStrip
                self._rows_per_strip = int(vals[0])
            elif tag == 279:  # StripByteCounts
                self._strip_byte_counts = [int(v) for v in vals]
            elif tag == 273:  # StripOffsets
                self._strip_offsets = [int(v) for v in vals]
            elif tag == 322:  # TileWidth
                self._tile_width = int(vals[0])
                self._tiled = True
            elif tag == 323:  # TileLength
                self._tile_height = int(vals[0])
            elif tag == 324:  # TileOffsets
                self._tile_offsets = [int(v) for v in vals]
            elif tag == 325:  # TileByteCounts
                self._tile_byte_counts = [int(v) for v in vals]
            elif tag == 317:  # Predictor
                self._predictor = int(vals[0])
            elif tag == 339:  # SampleFormat
                self._sample_format = int(vals[0])

        if self._tiled:
            self._tiles_across = math.ceil(self._cols / self._tile_width)
            self._tiles_down   = math.ceil(self._rows / self._tile_height)

    # --- public API ---------------------------------------------------------

    def read_window(self, col0: int, row0: int, width: int, height: int) -> list[list[float]]:
        """
        Read a rectangular window [col0..col0+width) x [row0..row0+height)
        from the DEM, returning a 2D list [row][col] of Float32 elevations.
        NaN for NoData.
        """
        result = [[float("nan")] * width for _ in range(height)]
        if self._tiled:
            self._read_window_tiled(col0, row0, width, height, result)
        else:
            self._read_window_stripped(col0, row0, width, height, result)
        return result

    # --- tiled reading ------------------------------------------------------

    def _read_window_tiled(self, col0, row0, width, height, result):
        tw, th = self._tile_width, self._tile_height
        t_col0 = col0 // tw
        t_row0 = row0 // th
        t_col1 = (col0 + width - 1) // tw
        t_row1 = (row0 + height - 1) // th

        for tr in range(t_row0, t_row1 + 1):
            for tc in range(t_col0, t_col1 + 1):
                tile_idx = tr * self._tiles_across + tc
                if tile_idx >= len(self._tile_offsets):
                    continue
                tile_raw = self._decompress_block(
                    self._tile_offsets[tile_idx],
                    self._tile_byte_counts[tile_idx],
                    tw * th * 4,
                )
                tile_floats = self._decode_samples(tile_raw, tw, th)
                # copy relevant pixels into result
                tile_col_start = tc * tw
                tile_row_start = tr * th
                for pr in range(th):
                    abs_row = tile_row_start + pr
                    dst_row = abs_row - row0
                    if dst_row < 0 or dst_row >= height:
                        continue
                    for pc in range(tw):
                        abs_col = tile_col_start + pc
                        dst_col = abs_col - col0
                        if dst_col < 0 or dst_col >= width:
                            continue
                        result[dst_row][dst_col] = tile_floats[pr * tw + pc]

    # --- strip reading ------------------------------------------------------

    def _read_window_stripped(self, col0, row0, width, height, result):
        rps = getattr(self, "_rows_per_strip", self._rows)
        bytes_per_row = self._cols * 4

        for strip_idx, (s_off, s_bc) in enumerate(
            zip(self._strip_offsets, self._strip_byte_counts)
        ):
            strip_row0 = strip_idx * rps
            strip_row1 = min(strip_row0 + rps, self._rows) - 1
            # overlap check
            if strip_row1 < row0 or strip_row0 >= row0 + height:
                continue
            actual_rows = min(rps, self._rows - strip_row0)
            strip_raw = self._decompress_block(s_off, s_bc, actual_rows * bytes_per_row)
            strip_floats = self._decode_samples(strip_raw, self._cols, actual_rows)
            for sr in range(actual_rows):
                abs_row = strip_row0 + sr
                dst_row = abs_row - row0
                if dst_row < 0 or dst_row >= height:
                    continue
                for dc in range(width):
                    abs_col = col0 + dc
                    if 0 <= abs_col < self._cols:
                        result[dst_row][dc] = strip_floats[sr * self._cols + abs_col]

    # --- decompression & predictor ------------------------------------------

    def _decode_samples(self, raw: bytes, width: int, height: int) -> list[float]:
        """Decode Float32 samples, handling TIFF Predictor 3 (floating-point)."""
        count = width * height
        if self._predictor == 3:
            row_bytes = width * 4
            floats = [float("nan")] * count
            for r in range(height):
                row_off = r * row_bytes
                if row_off + row_bytes > len(raw):
                    break
                row_buf = bytearray(raw[row_off: row_off + row_bytes])
                # Undo horizontal differencing
                for i in range(1, row_bytes):
                    row_buf[i] = (row_buf[i] + row_buf[i - 1]) & 0xFF
                # Untangle byte planes (MSB to LSB in TIFF Tech Note 3)
                dest_off = r * width
                b3_plane = row_buf[0:width]
                b2_plane = row_buf[width:2 * width]
                b1_plane = row_buf[2 * width:3 * width]
                b0_plane = row_buf[3 * width:4 * width]
                reassembled = bytearray(row_bytes)
                reassembled[0::4] = b0_plane
                reassembled[1::4] = b1_plane
                reassembled[2::4] = b2_plane
                reassembled[3::4] = b3_plane
                floats[dest_off: dest_off + width] = struct.unpack_from(f"<{width}f", reassembled)
            return floats
        # Predictor == 1 (no predictor)
        n_avail = min(count, len(raw) // 4)
        return list(struct.unpack_from(f"<{n_avail}f", raw))

    def _decompress_block(self, offset: int, byte_count: int, expected_bytes: int) -> bytes:
        raw = self._read_bytes(offset, byte_count)
        if self._compression == 1:   # None
            return raw
        elif self._compression in (5,):  # LZW — basic implementation
            return self._lzw_decode(raw, expected_bytes)
        elif self._compression in (8, 32946):  # Deflate/ZLib (RFC1950)
            return zlib.decompress(raw)
        else:
            raise ValueError(f"Unsupported TIFF compression: {self._compression}")

    @staticmethod
    def _lzw_decode(data: bytes, expected: int) -> bytes:
        """Basic TIFF LZW decoder (not needed for LOLA DEM which uses Deflate)."""
        raise NotImplementedError("LZW decompression not implemented; "
                                  "LOLA DEM uses Deflate (comp=8)")


# ---------------------------------------------------------------------------
# Synthetic DEM generator (for --dry-run / tests when no real DEM exists)
# ---------------------------------------------------------------------------

def make_synthetic_grid(width: int, height: int,
                        center_x_m: float, center_y_m: float,
                        pixel_scale: float) -> list[list[float]]:
    """
    Generate a synthetic elevation grid that approximates the lunar south-polar
    terrain: a broad depression (maria) with rim mountains and random noise.
    Used in --dry-run mode and unit tests only.
    """
    import random
    rng = random.Random(42)
    grid: list[list[float]] = []
    for row in range(height):
        row_data: list[float] = []
        for col in range(width):
            # projected coords of this pixel
            px = center_x_m - (width / 2 - col) * pixel_scale
            py = center_y_m - (height / 2 - row) * pixel_scale
            dist = math.hypot(px - center_x_m, py - center_y_m)
            # bowl shape: deep at centre, rises toward edges
            elev = -2000.0 + dist * 0.03 + rng.gauss(0, 30)
            row_data.append(elev)
        grid.append(row_data)
    return grid


# ---------------------------------------------------------------------------
# GLB writer (pure Python struct, binary glTF 2.0)
# ---------------------------------------------------------------------------

GLTF_MAGIC = 0x46546C67  # "glTF"
GLTF_VERSION = 2
JSON_CHUNK_TYPE = 0x4E4F534A   # "JSON"
BIN_CHUNK_TYPE  = 0x004E4942   # "BIN\0"


def _pad4(n: int) -> int:
    return (n + 3) & ~3


def _write_glb(out_path: str | Path,
               positions: list[tuple[float, float, float]],
               normals:   list[tuple[float, float, float]],
               uvs:       list[tuple[float, float]],
               indices:   list[int],
               bounds_info: dict) -> int:
    """
    Write a binary glTF 2.0 file.
    Returns file size in bytes.
    """
    n_verts = len(positions)
    n_idx   = len(indices)

    # --- pack binary buffer ------------------------------------------------
    # Layout: positions (vec3 f32) | normals (vec3 f32) | uvs (vec2 f32) | indices (u32)
    pos_bytes = struct.pack(f"<{n_verts * 3}f", *[v for p in positions for v in p])
    nrm_bytes = struct.pack(f"<{n_verts * 3}f", *[v for n in normals for v in n])
    uv_bytes  = struct.pack(f"<{n_verts * 2}f", *[v for u in uvs for v in u])
    idx_bytes = struct.pack(f"<{n_idx}I",  *indices)

    pos_offset = 0
    nrm_offset = pos_offset + len(pos_bytes)
    uv_offset  = nrm_offset + len(nrm_bytes)
    idx_offset = uv_offset  + len(uv_bytes)
    total_bin  = idx_offset + len(idx_bytes)

    bin_buf = pos_bytes + nrm_bytes + uv_bytes + idx_bytes

    # padding
    bin_pad = _pad4(total_bin) - total_bin
    bin_buf += b"\x00" * bin_pad

    # --- bounding box ------------------------------------------------------
    min_x = min(p[0] for p in positions)
    max_x = max(p[0] for p in positions)
    min_y = min(p[1] for p in positions)
    max_y = max(p[1] for p in positions)
    min_z = min(p[2] for p in positions)
    max_z = max(p[2] for p in positions)

    # --- glTF JSON ---------------------------------------------------------
    gltf_json = {
        "asset": {
            "version": "2.0",
            "generator": "Byte Force DATA-03 build_mesh.py",
            "copyright": ATTRIBUTION,
        },
        "scene": 0,
        "scenes": [{"name": "LunarTerrain", "nodes": [0]}],
        "nodes":  [{"name": "TerrainMesh", "mesh": 0}],
        "meshes": [{
            "name": "LunarSouthPoleTerrain",
            "primitives": [{
                "attributes": {
                    "POSITION": 0,
                    "NORMAL":   1,
                    "TEXCOORD_0": 2,
                },
                "indices": 3,
                "mode": 4,  # TRIANGLES
            }],
        }],
        "accessors": [
            # 0 — POSITION
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,   # FLOAT
                "count": n_verts,
                "type": "VEC3",
                "min": [min_x, min_y, min_z],
                "max": [max_x, max_y, max_z],
            },
            # 1 — NORMAL
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5126,
                "count": n_verts,
                "type": "VEC3",
            },
            # 2 — TEXCOORD_0
            {
                "bufferView": 2,
                "byteOffset": 0,
                "componentType": 5126,
                "count": n_verts,
                "type": "VEC2",
            },
            # 3 — INDICES
            {
                "bufferView": 3,
                "byteOffset": 0,
                "componentType": 5125,   # UNSIGNED_INT
                "count": n_idx,
                "type": "SCALAR",
            },
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": pos_offset, "byteLength": len(pos_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": nrm_offset, "byteLength": len(nrm_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": uv_offset,  "byteLength": len(uv_bytes),  "target": 34962},
            {"buffer": 0, "byteOffset": idx_offset,  "byteLength": len(idx_bytes), "target": 34963},
        ],
        "buffers": [{"byteLength": total_bin}],
        "extras": {
            "byteForce": {
                "task": "DATA-03",
                "dataset": SOURCE_DATASET,
                "verticalReference": VERTICAL_REFERENCE,
                "attribution": ATTRIBUTION,
                "boundsProjectedMeters": bounds_info.get("boundsProjectedMeters"),
                "meshLocalOriginMeters": bounds_info.get("meshLocalOrigin"),
            }
        },
    }

    json_str = json.dumps(gltf_json, separators=(",", ":")).encode("utf-8")
    json_pad = _pad4(len(json_str)) - len(json_str)
    json_str += b" " * json_pad   # JSON chunk padded with spaces

    # --- GLB header --------------------------------------------------------
    # total length = 12 (header) + 8 + json chunk + 8 + bin chunk
    total_len = 12 + 8 + len(json_str) + 8 + len(bin_buf)

    glb = struct.pack("<III", GLTF_MAGIC, GLTF_VERSION, total_len)
    glb += struct.pack("<II",  len(json_str), JSON_CHUNK_TYPE) + json_str
    glb += struct.pack("<II",  len(bin_buf),  BIN_CHUNK_TYPE)  + bin_buf

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(glb)
    return total_len


# ---------------------------------------------------------------------------
# Mesh builder
# ---------------------------------------------------------------------------

def build_mesh_from_grid(
    grid: list[list[float]],
    pixel_scale: float,
    origin_x_m: float,
    origin_y_m: float,
    ref_elevation: float = 0.0,
    local_origin_x: float = 0.0,
    local_origin_y: float = 0.0,
) -> tuple[list, list, list, list]:
    """
    Convert a 2-D elevation grid into mesh geometry (rebased around local origin).

    Grid coords (row, col) → scene coords:
        sceneX = X_proj - local_origin_x  (east)
        sceneY = elevation - ref_elevation  (up)
        sceneZ = -(Y_proj - local_origin_y)  (south)

    Returns: (positions, normals, uvs, indices)
    """
    rows = len(grid)
    cols = len(grid[0]) if rows else 0

    positions: list[tuple[float, float, float]] = []
    uvs:       list[tuple[float, float]]        = []

    for r in range(rows):
        for c in range(cols):
            x_proj = origin_x_m + c * pixel_scale
            y_proj = origin_y_m - r * pixel_scale
            elev   = grid[r][c]
            if not math.isfinite(elev):
                raise ValueError('NoData/nonfinite elevation in mesh; refusing synthetic fill')
            scene_x = x_proj - local_origin_x
            scene_y = elev - ref_elevation
            scene_z = -(y_proj - local_origin_y)
            positions.append((scene_x, scene_y, scene_z))
            uvs.append((c / max(1, cols - 1), r / max(1, rows - 1)))

    # --- normals (finite difference, +Y up, tz × tx) -----------------------
    normals: list[tuple[float, float, float]] = []
    for r in range(rows):
        for c in range(cols):
            c0 = max(0, c - 1)
            c1 = min(cols - 1, c + 1)
            r0 = max(0, r - 1)
            r1 = min(rows - 1, r + 1)

            dx = positions[r * cols + c1][0] - positions[r * cols + c0][0]
            dy_dx = positions[r * cols + c1][1] - positions[r * cols + c0][1]
            dz = positions[r1 * cols + c][2] - positions[r0 * cols + c][2]
            dy_dz = positions[r1 * cols + c][1] - positions[r0 * cols + c][1]

            # tz × tx where tx = (dx, dy_dx, 0), tz = (0, dy_dz, dz)
            nx = -dz * dy_dx
            ny = dz * dx
            nz = -dy_dz * dx
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            if length < 1e-9:
                normals.append((0.0, 1.0, 0.0))
            else:
                normals.append((nx / length, ny / length, nz / length))

    # --- indices (two triangles per quad) ------------------------------------
    indices: list[int] = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            tl = r * cols + c
            tr = tl + 1
            bl = tl + cols
            br = bl + 1
            # Triangle 1: TL, BL, TR
            indices.extend([tl, bl, tr])
            # Triangle 2: TR, BL, BR
            indices.extend([tr, bl, br])

    return positions, normals, uvs, indices


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def compute_window(lat: float, lon: float, radius_km: float, resolution_m: float
                   ) -> tuple[int, int, int, int, dict]:
    """Return (col0, row0, width, height) pixel window + geographic metadata."""
    cx, cy = latlon_to_proj(lat, lon)
    radius_m = radius_km * 1000.0
    half = radius_m

    min_x = cx - half
    max_x = cx + half
    min_y = cy - half
    max_y = cy + half

    col0_f, row0_f = proj_to_pixel(min_x, max_y)   # top-left corner
    col1_f, row1_f = proj_to_pixel(max_x, min_y)   # bottom-right corner

    col0 = max(0, int(math.floor(col0_f)))
    row0 = max(0, int(math.floor(row0_f)))
    col1 = min(DEM_COLS - 1, int(math.ceil(col1_f)))
    row1 = min(DEM_ROWS - 1, int(math.ceil(row1_f)))
    width  = col1 - col0
    height = row1 - row0

    if width < 2 or height < 2:
        raise ValueError(f"Window too small: {width}×{height}. "
                         f"Increase --radius-km or check lat/lon.")

    # geographic bounds
    proj_min_x, proj_max_y = pixel_to_proj(col0, row0)
    proj_max_x, proj_min_y = pixel_to_proj(col1, row1)
    lat_bl, lon_bl = proj_to_latlon(proj_min_x, proj_min_y)
    lat_br, lon_br = proj_to_latlon(proj_max_x, proj_min_y)
    lat_tl, lon_tl = proj_to_latlon(proj_min_x, proj_max_y)
    lat_tr, lon_tr = proj_to_latlon(proj_max_x, proj_max_y)

    meta = {
        "boundsProjectedMeters": {
            "minX": proj_min_x, "maxX": proj_max_x,
            "minY": proj_min_y, "maxY": proj_max_y,
        },
        "boundsGeographic": {
            "minLat": min(lat_bl, lat_br, lat_tl, lat_tr),
            "maxLat": max(lat_bl, lat_br, lat_tl, lat_tr),
            "minLon": min(lon_bl, lon_br, lon_tl, lon_tr),
            "maxLon": max(lon_bl, lon_br, lon_tl, lon_tr),
        },
        "meshLocalOrigin": [cx, cy, 0.0],
        "centerLatDeg": lat,
        "centerLonDeg": lon,
    }
    return col0, row0, width, height, meta


def run_pipeline(args) -> None:
    lat      = float(args.lat)
    lon      = float(args.lon)
    radius   = float(args.radius_km)
    res      = float(getattr(args, "resolution", DEM_PIXEL_SCALE_M))
    out_glb  = Path(args.output)
    manifest = Path(args.manifest) if args.manifest else None
    dry_run  = getattr(args, "dry_run", False)
    verbose  = getattr(args, "verbose", False)

    def log(msg):
        if verbose or dry_run:
            print(msg, flush=True)

    log(f"[build_mesh] centre=({lat}°, {lon}°), radius={radius} km")
    col0, row0, width, height, geo_meta = compute_window(lat, lon, radius, res)
    log(f"[build_mesh] DEM window: col={col0}..{col0+width}, row={row0}..{row0+height} ({width}×{height}px)")

    # --- read elevation grid ------------------------------------------------
    if dry_run:
        log("[build_mesh] DRY-RUN: generating synthetic elevation grid")
        cx, cy = geo_meta["meshLocalOrigin"][:2]
        grid = make_synthetic_grid(width, height, cx, cy, res)
    else:
        source_file = getattr(args, "source_file", None)
        source_url  = getattr(args, "source_url", None)
        if not source_file and not source_url:
            raise ValueError("Provide --source-file or --source-url (or use --dry-run)")
        log(f"[build_mesh] reading DEM from {'file' if source_file else 'URL'}")
        with BigTiffReader(source_file, source_url) as dem:
            if (dem.tags.get(33550) != [80.0, 80.0, 0.0] or
                    dem.tags.get(33922) != [0.0, 0.0, 0.0, -304000.0, 304000.0, 0.0] or
                    dem._cols != DEM_COLS or dem._rows != DEM_ROWS or res != 80.0 or
                    dem.tags.get(34735, [])[8:12] != [1025, 0, 1, 1]):
                raise ValueError('Source georeferencing differs from supported regional DEM')
            grid = dem.read_window(col0, row0, width, height)
            nodata_text = dem.tags.get(42113, ['nan'])[0]
            nodata = float(nodata_text)
            if any(not math.isfinite(v) or v == nodata for row in grid for v in row):
                raise ValueError('Source window contains NoData; refusing fabricated terrain')

    # reference elevation = median of non-NaN values in centre strip
    centre_values = []
    cr, cc = height // 2, width // 2
    half_strip = min(10, cr, cc)
    for r in range(cr - half_strip, cr + half_strip):
        for c in range(cc - half_strip, cc + half_strip):
            v = grid[r][c]
            if not math.isnan(v):
                centre_values.append(v)
    if centre_values:
        centre_values.sort()
        ref_elev = centre_values[len(centre_values) // 2]
    else:
        ref_elev = 0.0
    log(f"[build_mesh] reference elevation: {ref_elev:.1f} m")

    # --- build mesh --------------------------------------------------------
    # Window top-left in projected coords
    # GeoKey RasterPixelIsArea=1: tiepoint is pixel corner, samples lie at centres.
    win_x0, win_y0 = pixel_to_proj(col0 + 0.5, row0 + 0.5)
    local_cx, local_cy = geo_meta["meshLocalOrigin"][:2]
    positions, normals, uvs, indices = build_mesh_from_grid(
        grid, res, win_x0, win_y0, ref_elev,
        local_origin_x=local_cx, local_origin_y=local_cy,
    )
    log(f"[build_mesh] mesh: {len(positions)} vertices, {len(indices)//3} triangles")

    if dry_run:
        print(f"[DRY-RUN] Would write GLB to: {out_glb}")
        print(f"[DRY-RUN] Vertices: {len(positions)}, Triangles: {len(indices)//3}")
        if manifest:
            print(f"[DRY-RUN] Would write manifest to: {manifest}")
        return

    geo_meta['meshLocalOrigin'][2] = ref_elev

    # --- write GLB ---------------------------------------------------------
    bounds_info = {
        "boundsProjectedMeters": geo_meta["boundsProjectedMeters"],
        "meshLocalOrigin": geo_meta["meshLocalOrigin"],
    }
    file_size = _write_glb(out_glb, positions, normals, uvs, indices, bounds_info)
    log(f"[build_mesh] wrote {out_glb} ({file_size:,} bytes)")

    # --- write manifest ----------------------------------------------------
    if manifest:
        manifest_obj = {
            "boundsProjectedMeters": geo_meta["boundsProjectedMeters"],
            "boundsGeographic": geo_meta["boundsGeographic"],
            "meshLocalOrigin": geo_meta["meshLocalOrigin"],
            "centerLatDeg": geo_meta["centerLatDeg"],
            "centerLonDeg": geo_meta["centerLonDeg"],
            "referenceElevationMeters": ref_elev,
            "pixelScaleMeters": res,
            "gridSizePixels": {"width": width, "height": height},
            "sourceDataset": SOURCE_DATASET,
            "verticalReference": VERTICAL_REFERENCE,
            "attribution": ATTRIBUTION,
            "meshFile": out_glb.as_posix(),
            "fileSizeBytes": file_size,
            "generatedBy": "data-pipeline/terrain_mesh/build_mesh.py",
            "task": "DATA-03",
            "scientific_review_confirmed": False,
            "nodataPolicy": "Reject windows with nonfinite or declared NoData samples",
            "sampleCoordinates": "RasterPixelIsArea centres: tiepoint + half a pixel; no resampling",
            "sampleBoundsProjectedMeters": {"minX": win_x0, "maxX": win_x0 + (width-1)*res,
                                              "minY": win_y0 - (height-1)*res, "maxY": win_y0},
            "sceneAxes": {"x": "east", "y": "up relative to referenceElevationMeters", "z": "south"},
        }
        Path(manifest).parent.mkdir(parents=True, exist_ok=True)
        Path(manifest).write_text(json.dumps(manifest_obj, indent=2), encoding="utf-8")
        log(f"[build_mesh] wrote manifest: {manifest}")

    map_manifest = getattr(args, "map_manifest", None)
    if map_manifest:
        demo_url = getattr(args, "demo_url", "/terrain/0/0/0.glb")
        b_proj = geo_meta["boundsProjectedMeters"]
        map_manifest_obj = {
            "schemaVersion": 1,
            "metadata": {
                "regionId": "lunar-south-pole",
                "projection": {
                    "name": "south-polar-stereographic",
                    "projDefinition": f"+proj=stere +lat_0=-90 +lon_0=0 +R={int(MOON_RADIUS_M)} +units=m +no_defs",
                    "sourceFrame": "MOON_ME",
                    "linearUnit": "m",
                },
                "render": {
                    "type": "projected-terrain",
                    "tileSize": 256,
                    "minZoom": 0,
                    "maxZoom": 0,
                    "boundsMeters": {
                        "minX": b_proj["minX"],
                        "minY": b_proj["minY"],
                        "maxX": b_proj["maxX"],
                        "maxY": b_proj["maxY"],
                    },
                    "sceneTransform": {
                        "originEastingM": geo_meta["meshLocalOrigin"][0],
                        "originNorthingM": geo_meta["meshLocalOrigin"][1],
                        "verticalOriginM": ref_elev,
                        "validated": False,
                    },
                },
                "assets": {
                    "terrainTemplate": None,
                    "surfaceTemplate": None,
                    "hillshadeTemplate": None,
                    "demoMeshUrl": demo_url,
                },
                "terrainDataset": {
                    "id": "LDEM_80S_80MPP_ADJ",
                    "sourceResolutionMeters": res,
                    "verticalReference": VERTICAL_REFERENCE,
                    "metadataVerified": False,
                    "scientific_review_confirmed": False,
                },
            },
            "requiredAssets": [demo_url],
        }
        Path(map_manifest).parent.mkdir(parents=True, exist_ok=True)
        Path(map_manifest).write_text(json.dumps(map_manifest_obj, indent=2), encoding="utf-8")
        log(f"[build_mesh] wrote map manifest: {map_manifest}")

    print(f"Done. GLB: {out_glb} ({file_size:,} bytes), "
          f"{len(positions)} verts, {len(indices)//3} tris.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="build_mesh",
        description="Offline LOLA DEM → 3D GLB terrain mesh. "
                    "Uses only Python stdlib — no GDAL required.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--source-file", metavar="PATH",
                        help="Local GeoTIFF/BigTIFF DEM file path.")
    parser.add_argument("--source-url", metavar="URL",
                        help="Remote GeoTIFF URL (HTTP Range requests used).")
    parser.add_argument("--lat", type=float, default=-89.45,
                        help="Centre latitude (degrees, negative=south). Default: -89.45")
    parser.add_argument("--lon", type=float, default=-137.31,
                        help="Centre longitude (degrees). Default: -137.31 (Connecting Ridge)")
    parser.add_argument("--radius-km", type=float, default=5.0,
                        help="Half-extent of the terrain window in km. Default: 5")
    parser.add_argument("--resolution", type=float, default=DEM_PIXEL_SCALE_M,
                        help=f"DEM pixel scale in m (default: {DEM_PIXEL_SCALE_M}). "
                             "Use to match source DEM resolution.")
    parser.add_argument("--output", metavar="PATH",
                        default="public-assets/terrain/0/0/0.glb",
                        help="Output GLB file path.")
    parser.add_argument("--manifest", metavar="PATH",
                        default="public-assets/metadata/terrain-manifest.json",
                        help="Output manifest JSON path.")
    parser.add_argument("--map-manifest", metavar="PATH",
                        default="public-assets/metadata/map-manifest.json",
                        help="Output compatible MapManifest JSON path.")
    parser.add_argument("--demo-url", default="/terrain/0/0/0.glb",
                        help="Relative asset URL for demoMeshUrl. Default: /terrain/0/0/0.glb")
    parser.add_argument("--dry-run", action="store_true",
                        help="Generate a synthetic mesh (no DEM needed); "
                             "prints what would be done without writing GLB.")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Print progress messages.")
    args = parser.parse_args()
    run_pipeline(args)


if __name__ == "__main__":
    main()
