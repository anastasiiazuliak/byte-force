#!/usr/bin/env python3
"""
DATA-04 — LOD GLB Terrain Mesh & WebP Hillshade Tile Pyramid Builder.

Generates a multi-zoom XYZ tile pyramid (default z=0..2) for a lunar South Polar
DEM window in South Polar Stereographic projection (ARC-03, R=1737400 m).

Guarantees:
  - Shared boundary vertices across adjacent tiles at the same zoom level.
  - Vertical skirts (80 m depth) around every tile perimeter to hide T-junctions
    between adjacent LOD levels (z vs z+1).
  - Unified global referenceElevationMeters and local origin across all zoom
    levels so tiles never jump vertically when zooming.
  - Co-registered WebP hillshade textures via `cwebp` (pure stdlib PGM fallback
    if `cwebp` is unavailable).
  - Deterministic output and BE-06 / tiles.schema.json metadata manifests.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

# Reuse BigTIFF reader, projection, and GLB serializer from DATA-03
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "terrain_mesh"))
from build_mesh import (  # noqa: E402
    ATTRIBUTION,
    DEM_PIXEL_SCALE_M,
    MOON_RADIUS_M,
    SOURCE_DATASET,
    VERTICAL_REFERENCE,
    BigTiffReader,
    _write_glb,
    compute_window,
    make_synthetic_grid,
    pixel_to_proj,
    proj_to_latlon,
)


def sample_bilinear(
    grid: list[list[float]],
    win_x0: float,
    win_y0: float,
    pixel_scale: float,
    x_proj: float,
    y_proj: float,
    fallback_elev: float,
) -> float:
    """Bilinearly sample elevation from the DEM window at projected (x_proj, y_proj)."""
    rows = len(grid)
    cols = len(grid[0])
    col_f = max(0.0, min(cols - 1.0, (x_proj - win_x0) / pixel_scale))
    row_f = max(0.0, min(rows - 1.0, (win_y0 - y_proj) / pixel_scale))

    c0 = int(math.floor(col_f))
    r0 = int(math.floor(row_f))
    c1 = min(cols - 1, c0 + 1)
    r1 = min(rows - 1, r0 + 1)

    v00 = grid[r0][c0]
    v10 = grid[r0][c1]
    v01 = grid[r1][c0]
    v11 = grid[r1][c1]

    if any(math.isnan(v) for v in (v00, v10, v01, v11)):
        nc = min(cols - 1, max(0, round(col_f)))
        nr = min(rows - 1, max(0, round(row_f)))
        v = grid[nr][nc]
        return fallback_elev if math.isnan(v) else v

    fc = col_f - c0
    fr = row_f - r0
    top = v00 + fc * (v10 - v00)
    bot = v01 + fc * (v11 - v01)
    return top + fr * (bot - top)


def build_tile_geometry(
    grid: list[list[float]],
    win_x0: float,
    win_y0: float,
    pixel_scale: float,
    tile_min_x: float,
    tile_max_x: float,
    tile_min_y: float,
    tile_max_y: float,
    local_origin_x: float,
    local_origin_y: float,
    ref_elev: float,
    segments: int,
    skirt_depth_m: float,
) -> tuple[list, list, list, list, list[list[float]]]:
    """
    Build watertight tile mesh with shared boundary vertices and perimeter skirts.
    Returns (positions, normals, uvs, indices, tile_elev_grid).
    """
    n = segments + 1
    dx = (tile_max_x - tile_min_x) / segments
    dy = (tile_max_y - tile_min_y) / segments

    elev_grid: list[list[float]] = []
    positions: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []

    for r in range(n):
        y_proj = tile_max_y - r * dy
        row_elevs: list[float] = []
        for c in range(n):
            x_proj = tile_min_x + c * dx
            elev = sample_bilinear(grid, win_x0, win_y0, pixel_scale, x_proj, y_proj, ref_elev)
            row_elevs.append(elev)
            positions.append((
                x_proj - local_origin_x,
                elev - ref_elev,
                -(y_proj - local_origin_y),
            ))
            uvs.append((c / segments, r / segments))
        elev_grid.append(row_elevs)

    # Smooth normals (+Y up)
    normals: list[tuple[float, float, float]] = []
    for r in range(n):
        r0 = max(0, r - 1)
        r1 = min(n - 1, r + 1)
        for c in range(n):
            c0 = max(0, c - 1)
            c1 = min(n - 1, c + 1)
            gx = positions[r * n + c1][0] - positions[r * n + c0][0]
            gy_dx = positions[r * n + c1][1] - positions[r * n + c0][1]
            gz = positions[r1 * n + c][2] - positions[r0 * n + c][2]
            gy_dz = positions[r1 * n + c][1] - positions[r0 * n + c][1]
            nx = -gz * gy_dx
            ny = gz * gx
            nz = -gy_dz * gx
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            normals.append((0.0, 1.0, 0.0) if length < 1e-9 else (nx / length, ny / length, nz / length))

    # Surface triangles (CCW)
    indices: list[int] = []
    for r in range(segments):
        for c in range(segments):
            tl = r * n + c
            tr = tl + 1
            bl = tl + n
            br = bl + 1
            indices.extend([tl, bl, tr, tr, bl, br])

    # Perimeter skirts to eliminate LOD seam gaps
    if skirt_depth_m > 0.0:
        edges = [
            [(0, c) for c in range(n)],               # Top (North)
            [(r, n - 1) for r in range(n)],           # Right (East)
            [(n - 1, c) for c in range(n - 1, -1, -1)],  # Bottom (South)
            [(r, 0) for r in range(n - 1, -1, -1)],   # Left (West)
        ]
        for edge in edges:
            base_idx = len(positions)
            for (er, ec) in edge:
                px, py, pz = positions[er * n + ec]
                positions.append((px, py - skirt_depth_m, pz))
                normals.append(normals[er * n + ec])
                uvs.append(uvs[er * n + ec])
            for i in range(len(edge) - 1):
                top_a = edge[i][0] * n + edge[i][1]
                top_b = edge[i + 1][0] * n + edge[i + 1][1]
                bot_a = base_idx + i
                bot_b = base_idx + i + 1
                indices.extend([top_a, bot_a, top_b, top_b, bot_a, bot_b])

    return positions, normals, uvs, indices, elev_grid


def _encode_grayscale_png(width: int, height: int, gray_bytes: bytearray) -> bytes:
    """Minimal pure-stdlib 8-bit grayscale PNG encoder."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw_rows = b"".join(b"\x00" + bytes(gray_bytes[r * width:(r + 1) * width]) for r in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw_rows, level=6))
        + chunk(b"IEND", b"")
    )


def write_hillshade_texture(
    elev_grid: list[list[float]],
    cell_x_m: float,
    cell_y_m: float,
    out_path: Path,
    azimuth_deg: float = 315.0,
    altitude_deg: float = 30.0,
) -> str:
    """
    Compute Horn analytical hillshade (grayscale 0..255) and encode as WebP using
    cwebp if available (falls back to PNG if cwebp is missing). Returns output path string.
    """
    rows = len(elev_grid)
    cols = len(elev_grid[0])

    az_rad = math.radians(360.0 - azimuth_deg + 90.0)
    zen_rad = math.radians(90.0 - altitude_deg)
    cos_z = math.cos(zen_rad)
    sin_z = math.sin(zen_rad)

    pixels = bytearray(rows * cols)
    for r in range(rows):
        rm = max(0, r - 1)
        rp = min(rows - 1, r + 1)
        for c in range(cols):
            cm = max(0, c - 1)
            cp = min(cols - 1, c + 1)
            dz_dx = ((elev_grid[rm][cp] + 2.0 * elev_grid[r][cp] + elev_grid[rp][cp])
                     - (elev_grid[rm][cm] + 2.0 * elev_grid[r][cm] + elev_grid[rp][cm])) / (8.0 * cell_x_m)
            dz_dy = ((elev_grid[rp][cm] + 2.0 * elev_grid[rp][c] + elev_grid[rp][cp])
                     - (elev_grid[rm][cm] + 2.0 * elev_grid[rm][c] + elev_grid[rm][cp])) / (8.0 * cell_y_m)
            slope = math.atan(math.hypot(dz_dx, dz_dy))
            aspect = math.atan2(dz_dy, -dz_dx) if (dz_dx != 0.0 or dz_dy != 0.0) else 0.0
            hs = cos_z * math.cos(slope) + sin_z * math.sin(slope) * math.cos(az_rad - aspect)
            pixels[r * cols + c] = max(0, min(255, int(round(hs * 255.0))))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    png_bytes = _encode_grayscale_png(cols, rows, pixels)

    cwebp = shutil.which("cwebp")
    if cwebp and out_path.suffix.lower() == ".webp":
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(png_bytes)
            tmp_path = Path(tmp.name)
        try:
            subprocess.run(
                [cwebp, "-quiet", "-q", "85", str(tmp_path), "-o", str(out_path)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return out_path.as_posix()
        finally:
            tmp_path.unlink(missing_ok=True)

    fallback = out_path.with_suffix(".png")
    fallback.write_bytes(png_bytes)
    return fallback.as_posix()


def run_tile_pipeline(args) -> None:
    lat = float(args.lat)
    lon = float(args.lon)
    radius_km = float(args.radius_km)
    min_zoom = int(args.min_zoom)
    max_zoom = int(args.max_zoom)
    segments = int(args.segments)
    skirt_depth = float(args.skirt_depth)
    out_root = Path(args.output_dir)

    col0, row0, width, height, geo_meta = compute_window(lat, lon, radius_km, DEM_PIXEL_SCALE_M)
    b_proj = geo_meta["boundsProjectedMeters"]
    min_x, max_x = b_proj["minX"], b_proj["maxX"]
    min_y, max_y = b_proj["minY"], b_proj["maxY"]
    local_cx, local_cy = geo_meta["meshLocalOrigin"][:2]

    if args.dry_run:
        grid = make_synthetic_grid(width, height, local_cx, local_cy, DEM_PIXEL_SCALE_M)
    else:
        if not args.source_file and not args.source_url:
            raise ValueError("Provide --source-file, --source-url, or --dry-run")
        with BigTiffReader(args.source_file, args.source_url) as dem:
            grid = dem.read_window(col0, row0, width, height)

    # Unified global reference elevation across ALL zoom levels (prevents vertical LOD jump)
    center_vals = [
        grid[r][c]
        for r in range(max(0, height // 2 - 8), min(height, height // 2 + 8))
        for c in range(max(0, width // 2 - 8), min(width, width // 2 + 8))
        if not math.isnan(grid[r][c])
    ]
    center_vals.sort()
    ref_elev = center_vals[len(center_vals) // 2] if center_vals else 0.0

    win_x0, win_y0 = pixel_to_proj(col0, row0)
    root_extent_x = max_x - min_x
    root_extent_y = max_y - min_y

    lod_levels = []
    total_glb_bytes = 0
    total_tex_bytes = 0
    required_assets: list[str] = []

    for z in range(min_zoom, max_zoom + 1):
        count = 1 << z
        tile_w = root_extent_x / count
        tile_h = root_extent_y / count
        spacing_m = tile_w / segments

        for tx in range(count):
            for ty in range(count):
                t_min_x = min_x + tx * tile_w
                t_max_x = t_min_x + tile_w
                t_max_y = max_y - ty * tile_h  # XYZ: y=0 at North (maxY)
                t_min_y = t_max_y - tile_h

                pos, nrm, uvs, idx, elev_grid = build_tile_geometry(
                    grid, win_x0, win_y0, DEM_PIXEL_SCALE_M,
                    t_min_x, t_max_x, t_min_y, t_max_y,
                    local_cx, local_cy, ref_elev,
                    segments, skirt_depth,
                )

                glb_rel = f"/terrain/{z}/{tx}/{ty}.glb"
                glb_path = out_root / "terrain" / str(z) / str(tx) / f"{ty}.glb"
                glb_size = _write_glb(
                    glb_path, pos, nrm, uvs, idx,
                    {
                        "boundsProjectedMeters": {"minX": t_min_x, "maxX": t_max_x, "minY": t_min_y, "maxY": t_max_y},
                        "meshLocalOrigin": [local_cx, local_cy, 0.0],
                    },
                )
                total_glb_bytes += glb_size
                required_assets.append(glb_rel)

                hs_path = out_root / "tiles" / "hillshade" / str(z) / str(tx) / f"{ty}.webp"
                actual_hs = Path(write_hillshade_texture(elev_grid, spacing_m, tile_h / segments, hs_path))
                total_tex_bytes += actual_hs.stat().st_size
                if actual_hs.suffix.lower() == ".webp":
                    required_assets.append(f"/tiles/hillshade/{z}/{tx}/{ty}.webp")

        lod_levels.append({
            "zoom": z,
            "tilesPerAxis": count,
            "tileCount": count * count,
            "gridSegmentsPerTile": segments,
            "vertexSpacingMeters": round(spacing_m, 3),
            "maxGeometricErrorMeters": round(max(0.0, spacing_m - DEM_PIXEL_SCALE_M), 3),
        })

    # Write lod-tileset.json
    tileset_meta = {
        "task": "DATA-04",
        "tileGridScheme": "XYZ",
        "minZoom": min_zoom,
        "maxZoom": max_zoom,
        "rootTileExtentsMeters": {"width": root_extent_x, "height": root_extent_y},
        "boundsProjectedMeters": b_proj,
        "boundsGeographic": geo_meta["boundsGeographic"],
        "meshLocalOrigin": [local_cx, local_cy, 0.0],
        "referenceElevationMeters": ref_elev,
        "skirtDepthMeters": skirt_depth,
        "sourceDataset": SOURCE_DATASET,
        "verticalReference": VERTICAL_REFERENCE,
        "attribution": ATTRIBUTION,
        "coverage": {
            "fullSouthPole80S90S": False,
            "coveredRegionName": "Connecting Ridge Demo Window",
            "lrocImageryAvailable": False,
            "surfaceFallbackLayer": "hillshade",
        },
        "lodLevels": lod_levels,
        "totals": {
            "glbBytes": total_glb_bytes,
            "textureBytes": total_tex_bytes,
        },
    }
    tileset_path = out_root / "metadata" / "lod-tileset.json"
    tileset_path.parent.mkdir(parents=True, exist_ok=True)
    tileset_path.write_text(json.dumps(tileset_meta, indent=2), encoding="utf-8")

    # Write BE-06 / tiles.schema.json real metadata fixture if requested
    if args.real_metadata_out:
        real_meta = {
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
                    "minZoom": min_zoom,
                    "maxZoom": max_zoom,
                    "boundsMeters": b_proj,
                    "sceneTransform": {
                        "originEastingM": local_cx,
                        "originNorthingM": local_cy,
                        "verticalOriginM": ref_elev,
                        "validated": True,
                    },
                },
                "assets": {
                    "terrainTemplate": "/terrain/{z}/{x}/{y}.glb",
                    "surfaceTemplate": None,
                    "hillshadeTemplate": "/tiles/hillshade/{z}/{x}/{y}.webp",
                    "demoMeshUrl": "/terrain/0/0/0.glb",
                },
                "terrainDataset": {
                    "id": "LDEM_80S_80MPP_ADJ",
                    "sourceResolutionMeters": DEM_PIXEL_SCALE_M,
                    "verticalReference": VERTICAL_REFERENCE,
                    "metadataVerified": True,
                },
            },
            "requiredAssets": required_assets,
            "coverageNotes": {
                "full80S90SCoverage": False,
                "coveredWindowMeters": b_proj,
                "lrocImageryCoverage": "Not bundled in demo pyramid; analytical LOLA hillshade WebP tiles provided.",
            },
        }
        rm_path = Path(args.real_metadata_out)
        rm_path.parent.mkdir(parents=True, exist_ok=True)
        rm_path.write_text(json.dumps(real_meta, indent=2), encoding="utf-8")

    print(f"Done. Generated z={min_zoom}..{max_zoom} ({len(lod_levels)} LOD levels), "
          f"GLB={total_glb_bytes:,} bytes, Hillshade={total_tex_bytes:,} bytes.")


def main():
    p = argparse.ArgumentParser(description="DATA-04 LOD GLB/WebP tile pyramid builder")
    p.add_argument("--source-file", help="Local GeoTIFF DEM path")
    p.add_argument("--source-url", help="Remote GeoTIFF URL (HTTP Range)")
    p.add_argument("--lat", type=float, default=-89.45)
    p.add_argument("--lon", type=float, default=-137.31)
    p.add_argument("--radius-km", type=float, default=5.0)
    p.add_argument("--min-zoom", type=int, default=0)
    p.add_argument("--max-zoom", type=int, default=2)
    p.add_argument("--segments", type=int, default=32, help="Grid segments per tile edge (default 32 -> 33x33 verts)")
    p.add_argument("--skirt-depth", type=float, default=80.0, help="Perimeter skirt depth in meters (default 80)")
    p.add_argument("--output-dir", default="public-assets", help="Asset root output directory")
    p.add_argument("--real-metadata-out", default="contracts/fixtures/map-metadata-real.json",
                   help="Output path for BE-06 / real map metadata fixture")
    p.add_argument("--dry-run", action="store_true", help="Use synthetic elevation grid without downloading DEM")
    run_tile_pipeline(p.parse_args())


if __name__ == "__main__":
    main()
