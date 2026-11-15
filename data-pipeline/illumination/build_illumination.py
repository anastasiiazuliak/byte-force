#!/usr/bin/env python3
"""
P2-01 — Scientific Lunar Illumination & Shadow Raster Mask Generator.

Computes physically-based Sun visibility masks from LOLA DEM elevations,
accounting for lunar spherical curvature (R = 1,737,400 m), far-field terrain
obstructions, and ARC-03 polar azimuth conventions.

Outputs RGBA WebP tiles at:
  public-assets/illumination/{timeKey}/{z}/{x}/{y}.webp
and provenance/accuracy metadata at:
  public-assets/illumination/illumination-manifest.json
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
import time
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "terrain_mesh"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tiles"))

from build_mesh import (  # noqa: E402
    ATTRIBUTION,
    DEM_PIXEL_SCALE_M,
    MOON_RADIUS_M,
    SOURCE_DATASET,
    VERTICAL_REFERENCE,
    BigTiffReader,
    compute_window,
    make_synthetic_grid,
    pixel_to_proj,
)
from build_tiles import sample_bilinear  # noqa: E402


def _polar_local_basis(obs_x: float, obs_y: float) -> tuple[float, float, float, float]:
    """ARC-03 polar North (0 deg) and East (90 deg) unit vectors in projected (X, Y)."""
    rho = math.hypot(obs_x, obs_y)
    if rho <= 1e-6:
        return 0.0, 1.0, 1.0, 0.0
    return obs_x / rho, obs_y / rho, obs_y / rho, -obs_x / rho


def _encode_rgba_png(width: int, height: int, rgba_bytes: bytearray) -> bytes:
    """Minimal pure-stdlib 8-bit RGBA PNG encoder."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    stride = width * 4
    raw_rows = b"".join(b"\x00" + bytes(rgba_bytes[r * stride:(r + 1) * stride]) for r in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw_rows, level=6))
        + chunk(b"IEND", b"")
    )


def _write_rgba_webp(width: int, height: int, rgba_bytes: bytearray, out_path: Path) -> str:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    png_bytes = _encode_rgba_png(width, height, rgba_bytes)
    cwebp = shutil.which("cwebp")
    if cwebp and out_path.suffix.lower() == ".webp":
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(png_bytes)
            tmp_path = Path(tmp.name)
        try:
            subprocess.run(
                [cwebp, "-quiet", "-lossless", str(tmp_path), "-o", str(out_path)],
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


def _sample_bilinear_cell(
    grid: list[list[float]],
    cols: int,
    rows: int,
    col_f: float,
    row_f: float,
    fallback_elev: float,
) -> float:
    c0 = int(math.floor(col_f))
    r0 = int(math.floor(row_f))
    c1 = cols - 1 if c0 + 1 >= cols else c0 + 1
    r1 = rows - 1 if r0 + 1 >= rows else r0 + 1

    row0 = grid[r0]
    row1 = grid[r1]
    v00 = row0[c0]
    v10 = row0[c1]
    v01 = row1[c0]
    v11 = row1[c1]

    if math.isnan(v00) or math.isnan(v10) or math.isnan(v01) or math.isnan(v11):
        nc = min(cols - 1, max(0, round(col_f)))
        nr = min(rows - 1, max(0, round(row_f)))
        v = grid[nr][nc]
        return fallback_elev if math.isnan(v) else v

    fc = col_f - c0
    fr = row_f - r0
    top = v00 + fc * (v10 - v00)
    bot = v01 + fc * (v11 - v01)
    return top + fr * (bot - top)


def compute_sun_visibility_at_point(
    grid: list[list[float]],
    win_x0: float,
    win_y0: float,
    pixel_scale: float,
    obs_x: float,
    obs_y: float,
    sun_az_deg: float,
    sun_el_deg: float,
    ray_step_m: float,
    max_range_m: float,
    _precomputed_steps: list[tuple[float, float, float]] | None = None,
) -> int:
    """
    Returns:
      1 = sunlit (clearance > 0),
      0 = shadowed (terrain horizon >= sun_el_deg),
     -1 = NoData at observer.
    """
    rows = len(grid)
    cols = len(grid[0])
    inv_scale = 1.0 / pixel_scale
    col_f = (obs_x - win_x0) * inv_scale
    row_f = (win_y0 - obs_y) * inv_scale
    max_col = cols - 1
    max_row = rows - 1
    if col_f < 0.0 or col_f > max_col or row_f < 0.0 or row_f > max_row:
        return -1

    c0 = min(max_col, max(0, round(col_f)))
    r0 = min(max_row, max(0, round(row_f)))
    if math.isnan(grid[r0][c0]):
        return -1

    obs_elev = _sample_bilinear_cell(grid, cols, rows, col_f, row_f, 0.0)
    r_obs = MOON_RADIUS_M + obs_elev + 2.0  # 2m observer clearance

    nx, ny, ex, ey = _polar_local_basis(obs_x, obs_y)
    az_rad = math.radians(sun_az_deg)
    cos_az = math.cos(az_rad)
    sin_az = math.sin(az_rad)
    dir_x = cos_az * nx + sin_az * ex
    dir_y = cos_az * ny + sin_az * ey
    dcol_per_m = dir_x * inv_scale
    drow_per_m = -dir_y * inv_scale

    use_slope = -89.9 <= sun_el_deg <= 89.9
    sun_tan = math.tan(math.radians(sun_el_deg)) if use_slope else 0.0

    if _precomputed_steps is None:
        _precomputed_steps = []
        dist = ray_step_m
        while dist <= max_range_m:
            psi = dist / MOON_RADIUS_M
            _precomputed_steps.append((dist, math.cos(psi), math.sin(psi)))
            dist += ray_step_m

    for dist, cos_psi, sin_psi in _precomputed_steps:
        sc = col_f + dist * dcol_per_m
        sr = row_f + dist * drow_per_m
        if sc < 0.0 or sc > max_col or sr < 0.0 or sr > max_row:
            break
        sample_elev = _sample_bilinear_cell(grid, cols, rows, sc, sr, obs_elev)
        rs = MOON_RADIUS_M + sample_elev
        num = rs * cos_psi - r_obs
        den = rs * sin_psi
        if use_slope and den > 0.0:
            if num >= sun_tan * den:
                return 0  # early exit: already occluded
        elif math.degrees(math.atan2(num, den)) >= sun_el_deg:
            return 0

    return 1


def parse_timestamp_spec(spec: str) -> dict:
    """Parse 'timeKey|timeUtc|azDeg|elDeg'."""
    parts = spec.split("|")
    if len(parts) != 4:
        raise ValueError(f"Invalid --epoch spec '{spec}'. Expected 'timeKey|timeUtc|azDeg|elDeg'.")
    return {
        "timeKey": parts[0].strip(),
        "timeUtc": parts[1].strip(),
        "sunAzimuthDeg": float(parts[2]),
        "sunElevationDeg": float(parts[3]),
    }


def run_illumination_pipeline(args) -> None:
    lat = float(args.lat)
    lon = float(args.lon)
    radius_km = float(args.radius_km)
    tile_px = int(args.tile_size)
    ray_step = float(args.ray_step)
    max_range = float(args.max_range_km) * 1000.0
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

    win_x0, win_y0 = pixel_to_proj(col0, row0)
    epochs = [parse_timestamp_spec(s) for s in args.epoch]

    precomputed_steps: list[tuple[float, float, float]] = []
    dist = ray_step
    while dist <= max_range:
        psi = dist / MOON_RADIUS_M
        precomputed_steps.append((dist, math.cos(psi), math.sin(psi)))
        dist += ray_step

    manifest_epochs = []
    for ep in epochs:
        t0 = time.perf_counter()
        time_key = ep["timeKey"]
        az_deg = ep["sunAzimuthDeg"]
        el_deg = ep["sunElevationDeg"]

        rgba = bytearray(tile_px * tile_px * 4)
        lit_cnt = 0
        shadow_cnt = 0
        nodata_cnt = 0

        dx = (max_x - min_x) / max(1, tile_px - 1)
        dy = (max_y - min_y) / max(1, tile_px - 1)

        for r in range(tile_px):
            y_proj = max_y - r * dy
            for c in range(tile_px):
                x_proj = min_x + c * dx
                vis = compute_sun_visibility_at_point(
                    grid, win_x0, win_y0, DEM_PIXEL_SCALE_M,
                    x_proj, y_proj, az_deg, el_deg, ray_step, max_range,
                    _precomputed_steps=precomputed_steps,
                )
                off = (r * tile_px + c) * 4
                if vis == 1:
                    # Sunlit: subtle warm highlight
                    rgba[off:off + 4] = b"\xff\xe6\x80\x50"
                    lit_cnt += 1
                elif vis == 0:
                    # Shadowed: deep scientific shadow mask
                    rgba[off:off + 4] = b"\x08\x0c\x18\xb4"
                    shadow_cnt += 1
                else:
                    # NoData: transparent magenta-warning or fully transparent
                    rgba[off:off + 4] = b"\x00\x00\x00\x00"
                    nodata_cnt += 1

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        out_tile = out_root / time_key / "0" / "0" / "0.webp"
        actual_path = _write_rgba_webp(tile_px, tile_px, rgba, out_tile)
        total_px = tile_px * tile_px

        manifest_epochs.append({
            "timeKey": time_key,
            "timeUtc": ep["timeUtc"],
            "sunAzimuthDeg": az_deg,
            "sunElevationDeg": el_deg,
            "ephemerisSource": "JPL Horizons coord@301 benchmark",
            "tileTemplate": f"/illumination/{time_key}/{{z}}/{{x}}/{{y}}.webp",
            "demoTile": f"/illumination/{time_key}/0/0/0{Path(actual_path).suffix}",
            "tileSizePx": tile_px,
            "litFraction": round(lit_cnt / total_px, 4),
            "shadowFraction": round(shadow_cnt / total_px, 4),
            "noDataFraction": round(nodata_cnt / total_px, 4),
            "cpuCostMs": elapsed_ms,
        })

    manifest = {
        "task": "P2-01",
        "title": "Scientific Lunar Illumination Raster Masks",
        "sourceDataset": SOURCE_DATASET,
        "verticalReference": VERTICAL_REFERENCE,
        "attribution": ATTRIBUTION,
        "boundsProjectedMeters": b_proj,
        "boundsGeographic": geo_meta["boundsGeographic"],
        "methodology": {
            "demResolutionMeters": DEM_PIXEL_SCALE_M,
            "rayStepMeters": ray_step,
            "maxRayRangeMeters": max_range,
            "lunarSphereRadiusMeters": MOON_RADIUS_M,
            "solarModel": "Point-source center-of-disk (0.53 deg penumbra zone noted in SCIENCE_METHOD.md)",
            "coverageNote": "Covers Connecting Ridge demo window only; 404 on uncovered tiles should hide overlay.",
        },
        "timestamps": manifest_epochs,
    }
    manifest_path = out_root / "illumination-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Done. Generated {len(manifest_epochs)} illumination masks -> {manifest_path}")


def main():
    p = argparse.ArgumentParser(description="P2-01 Scientific Illumination Mask Generator")
    p.add_argument("--source-file", help="Local GeoTIFF DEM path")
    p.add_argument("--source-url", help="Remote GeoTIFF URL (HTTP Range)")
    p.add_argument("--lat", type=float, default=-89.45)
    p.add_argument("--lon", type=float, default=-137.31)
    p.add_argument("--radius-km", type=float, default=5.0)
    p.add_argument("--tile-size", type=int, default=64, help="Output mask resolution (default 64x64)")
    p.add_argument("--ray-step", type=float, default=80.0)
    p.add_argument("--max-range-km", type=float, default=5.0)
    p.add_argument("--output-dir", default="public-assets/illumination")
    p.add_argument(
        "--epoch",
        action="append",
        default=[
            "2026-03-01T00Z|2026-03-01T00:00:00Z|142.5|1.25",
            "2026-03-08T00Z|2026-03-08T00:00:00Z|52.0|1.45",
        ],
        help="Epoch spec 'timeKey|timeUtc|azDeg|elDeg'",
    )
    p.add_argument("--dry-run", action="store_true")
    run_illumination_pipeline(p.parse_args())


if __name__ == "__main__":
    main()
