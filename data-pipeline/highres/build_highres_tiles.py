#!/usr/bin/env python3
"""
P2-03 — High-Resolution (5 m/pixel) Nested Lunar DEM Tile Builder.

Generates a nested high-detail 3D GLB tile set for a small selected region
(e.g. Connecting Ridge CR1 landing pad zone) aligned to the base 80 m/px
datum and local origin so LOD transitions exhibit zero vertical jumps.

Can be disabled safely without affecting the MVP 80 m/px terrain pipeline.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "terrain_mesh"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tiles"))

from build_mesh import (  # noqa: E402
    MOON_RADIUS_M,
    BigTiffReader,
    _write_glb,
    latlon_to_proj,
    pixel_to_proj,
    proj_to_latlon,
)
from build_tiles import build_tile_geometry  # noqa: E402

HIGHRES_DATASET = "LDEM_875S_5MPP (NASA PGDA 5 m/px LOLA)"
HIGHRES_PROVENANCE = "High-resolution local DEM"
HIGHRES_ATTRIBUTION = "NASA GSFC PGDA / LOLA 5 m/px Polar Product"


def make_highres_synthetic_patch(
    width: int, height: int, center_x: float, center_y: float, pixel_scale: float, base_elev: float
) -> list[list[float]]:
    """Deterministic micro-topography test patch (5 m/px) for dry-run/CI verification."""
    grid: list[list[float]] = []
    for r in range(height):
        row: list[float] = []
        for c in range(width):
            px = center_x + (c - width / 2.0) * pixel_scale
            py = center_y + (height / 2.0 - r) * pixel_scale
            # Smooth micro-crater + ridge modulation around base_elev
            ripple = 3.5 * math.sin(px / 45.0) * math.cos(py / 45.0)
            row.append(base_elev + ripple)
        grid.append(row)
    return grid


def run_highres_pipeline(args) -> None:
    base_manifest = json.loads(Path(args.base_manifest).read_text(encoding="utf-8"))
    local_cx, local_cy = base_manifest["meshLocalOrigin"][:2]
    ref_elev = float(base_manifest["referenceElevationMeters"])

    lat = float(args.lat)
    lon = float(args.lon)
    cx, cy = latlon_to_proj(lat, lon)
    half_m = float(args.radius_m)
    res_m = float(args.resolution)
    segments = int(args.segments)
    skirt_depth = float(args.skirt_depth)
    out_root = Path(args.output_dir)

    min_x, max_x = cx - half_m, cx + half_m
    min_y, max_y = cy - half_m, cy + half_m

    cols = max(4, int(math.ceil((max_x - min_x) / res_m)))
    rows = max(4, int(math.ceil((max_y - min_y) / res_m)))

    if args.dry_run:
        grid = make_highres_synthetic_patch(cols, rows, cx, cy, res_m, ref_elev)
        win_x0, win_y0 = min_x, max_y
    else:
        if not args.source_file and not args.source_url:
            raise ValueError("Provide --source-file, --source-url, or --dry-run")
        with BigTiffReader(args.source_file, args.source_url) as dem:
            # 5 m/px LOLA product origin (-150000, +150000) or read from window
            col0 = max(0, int(math.floor((min_x - (-150_000.0)) / res_m)))
            row0 = max(0, int(math.floor((150_000.0 - max_y) / res_m)))
            grid = dem.read_window(col0, row0, cols, rows)
            win_x0 = -150_000.0 + col0 * res_m
            win_y0 = 150_000.0 - row0 * res_m

    # Generate 2x2 nested tiles (zoom 3 equivalent in local highres)
    tiles_per_axis = 2
    tile_w = (max_x - min_x) / tiles_per_axis
    tile_h = (max_y - min_y) / tiles_per_axis
    tile_paths: list[str] = []
    total_bytes = 0

    for tx in range(tiles_per_axis):
        for ty in range(tiles_per_axis):
            t_min_x = min_x + tx * tile_w
            t_max_x = t_min_x + tile_w
            t_max_y = max_y - ty * tile_h
            t_min_y = t_max_y - tile_h

            pos, nrm, uvs, idx, _ = build_tile_geometry(
                grid, win_x0, win_y0, res_m,
                t_min_x, t_max_x, t_min_y, t_max_y,
                local_cx, local_cy, ref_elev,
                segments, skirt_depth,
            )

            rel_url = f"/terrain/highres/3/{tx}/{ty}.glb"
            glb_path = out_root / "terrain" / "highres" / "3" / str(tx) / f"{ty}.glb"
            if not args.no_write_glb:
                total_bytes += _write_glb(
                    glb_path, pos, nrm, uvs, idx,
                    {
                        "boundsProjectedMeters": {"minX": t_min_x, "maxX": t_max_x, "minY": t_min_y, "maxY": t_max_y},
                        "meshLocalOrigin": [local_cx, local_cy, 0.0],
                    },
                )
            tile_paths.append(rel_url)

    lat_min, lon_min = proj_to_latlon(min_x, min_y)
    lat_max, lon_max = proj_to_latlon(max_x, max_y)

    manifest = {
        "task": "P2-03",
        "enabled": not args.dry_run,
        "status": "pending_nasa_5mpp_dem_download" if args.dry_run else "ready",
        "optional": True,
        "provenance": HIGHRES_PROVENANCE,
        "sourceDataset": HIGHRES_DATASET,
        "attribution": HIGHRES_ATTRIBUTION,
        "resolutionMeters": res_m,
        "verticalDatumNormalizedToBase": True,
        "baseReferenceElevationMeters": ref_elev,
        "baseMeshLocalOrigin": [local_cx, local_cy, 0.0],
        "skirtDepthMeters": skirt_depth,
        "coverage": {
            "regionName": "Connecting Ridge CR1 High-Detail Zone",
            "fullSouthPoleCoverage": False,
            "boundsProjectedMeters": {"minX": min_x, "maxX": max_x, "minY": min_y, "maxY": max_y},
            "boundsGeographic": {
                "minLat": min(lat_min, lat_max),
                "maxLat": max(lat_min, lat_max),
                "minLon": min(lon_min, lon_max),
                "maxLon": max(lon_min, lon_max),
            },
        },
        "fallbackPolicy": "Render base 80 m/px DEM outside covered bounds or when highres is disabled.",
        "horizonDisclaimer": (
            "5 m/px DEM refines local 3D terrain geometry only; scientific far-field horizon "
            "analysis continues to use the 80 m/px LOLA DEM unless high-res horizon data is loaded."
        ),
        "tileTemplate": "/terrain/highres/{z}/{x}/{y}.glb",
        "tiles": tile_paths,
        "totalGlbBytes": total_bytes,
    }

    manifest_path = out_root / "metadata" / "highres-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Done. High-res manifest written to {manifest_path} ({len(tile_paths)} tiles, {total_bytes:,} bytes).")


def main():
    p = argparse.ArgumentParser(description="P2-03 5 m/px High-Resolution Nested DEM Tile Builder")
    p.add_argument("--base-manifest", default="public-assets/metadata/lod-tileset.json")
    p.add_argument("--source-file", help="Local 5 m/px LOLA GeoTIFF file")
    p.add_argument("--source-url", help="Remote 5 m/px LOLA GeoTIFF URL")
    p.add_argument("--lat", type=float, default=-89.45)
    p.add_argument("--lon", type=float, default=-137.31)
    p.add_argument("--radius-m", type=float, default=320.0, help="Half-extent in meters (default 320 m -> 640x640 m)")
    p.add_argument("--resolution", type=float, default=5.0)
    p.add_argument("--segments", type=int, default=32)
    p.add_argument("--skirt-depth", type=float, default=20.0)
    p.add_argument("--output-dir", default="public-assets")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--no-write-glb", action="store_true", help="Write manifest only without GLB files")
    run_highres_pipeline(p.parse_args())


if __name__ == "__main__":
    main()
