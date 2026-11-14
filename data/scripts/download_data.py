#!/usr/bin/env python3
"""
Lunar Landing Site Navigator — NASA Data Downloader & Validator (HUM-02)

Downloads and verifies official NASA Planetary Geodynamics Data Archive (PGDA)
LOLA elevation models and hillshade rasters for the Lunar South Pole (80°S–90°S).

Usage:
    python download_data.py --verify-only
    python download_data.py --download
    python download_data.py --download --dem-only
"""

import argparse
import hashlib
import os
import sys
import urllib.request
import urllib.error

# Official NASA PGDA URLs and metadata
DATASETS = {
    "LDEM_80S_80MPP_ADJ.TIF": {
        "url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF",
        "description": "LOLA Adjusted Digital Elevation Model (80m/px, 80°S-90°S)",
        "expected_bytes": 189158392,
        "format": "Cloud-Optimized GeoTIFF (BigTIFF, Float32, Deflate)",
        "crs": "Moon 2015 Sphere / South Polar Stereographic",
    },
    "LDEM_80S_80MPP_ADJ_HILL.TIF": {
        "url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_HILL.TIF",
        "description": "LOLA Hillshade raster (80m/px, 45° altitude, 45° azimuth)",
        "expected_bytes": 88474342,
        "format": "Cloud-Optimized GeoTIFF (BigTIFF, Byte, Deflate)",
        "crs": "Moon 2015 Sphere / South Polar Stereographic",
    }
}

def get_default_output_dir() -> str:
    # Check environment variable first, then fallback to <repo>/data/raw
    env_path = os.environ.get("LUNAR_DATA_DIR") or os.environ.get("LUNAR_DEM_PATH")
    if env_path:
        if os.path.isfile(env_path):
            return os.path.dirname(os.path.abspath(env_path))
        return os.path.abspath(env_path)
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(script_dir, "..", "raw"))

def verify_remote_url(name: str, meta: dict) -> bool:
    print(f"\n[CHECK] Probing remote NASA server for: {name}...")
    req = urllib.request.Request(meta["url"], method="HEAD")
    req.add_header("User-Agent", "ByteForce-LunarNavigator/1.0 (NASA Space Apps)")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            headers = dict(resp.info())
            length = int(headers.get("Content-Length", 0))
            last_mod = headers.get("Last-Modified", "N/A")
            etag = headers.get("ETag", "N/A")
            accept_ranges = headers.get("Accept-Ranges", "none")
            
            print(f"  Status:         200 OK")
            print(f"  Remote size:    {length:,} bytes ({length / (1024*1024):.2f} MB)")
            print(f"  Expected size:  {meta['expected_bytes']:,} bytes")
            print(f"  Last-Modified:  {last_mod}")
            print(f"  ETag:           {etag}")
            print(f"  Accept-Ranges:  {accept_ranges} (Cloud-Optimized GeoTIFF streaming supported)")
            
            if length == meta["expected_bytes"]:
                print(f"  -> SIZE MATCH: Exact match with official PGDA catalog!")
                return True
            else:
                print(f"  [WARN] Size mismatch! Remote={length}, expected={meta['expected_bytes']}")
                return False
    except urllib.error.URLError as e:
        print(f"  [ERROR] Connection failed: {e}")
        return False

def download_file(name: str, meta: dict, dest_dir: str) -> bool:
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, name)
    
    # Check if already downloaded
    if os.path.exists(dest_path):
        actual_size = os.path.getsize(dest_path)
        if actual_size == meta["expected_bytes"]:
            print(f"\n[EXISTS] {dest_path} is already downloaded and size matches ({actual_size:,} bytes).")
            return True
        else:
            print(f"\n[PARTIAL/CORRUPT] Local file size ({actual_size:,}) != expected ({meta['expected_bytes']:,}). Re-downloading...")

    print(f"\n[DOWNLOADING] {name} from {meta['url']}")
    print(f"  Destination: {dest_path}")
    print(f"  Size: {meta['expected_bytes']:,} bytes ({meta['expected_bytes'] / (1024*1024):.2f} MB)")

    req = urllib.request.Request(meta["url"])
    req.add_header("User-Agent", "ByteForce-LunarNavigator/1.0")

    try:
        with urllib.request.urlopen(req, timeout=60) as resp, open(dest_path, "wb") as out_file:
            downloaded = 0
            chunk_size = 1024 * 1024  # 1MB chunk
            total = meta["expected_bytes"]
            
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                out_file.write(chunk)
                downloaded += len(chunk)
                percent = (downloaded / total) * 100 if total > 0 else 0
                mb_down = downloaded / (1024 * 1024)
                mb_tot = total / (1024 * 1024)
                sys.stdout.write(f"\r  Progress: [{percent:5.1f}%] {mb_down:.1f} / {mb_tot:.1f} MB")
                sys.stdout.flush()
        
        print("\n  -> Download completed successfully!")
        return True
    except Exception as e:
        print(f"\n  [ERROR] Download failed: {e}")
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return False

def main():
    parser = argparse.ArgumentParser(description="NASA LOLA Data Downloader & Validator")
    parser.add_argument("--verify-only", "-v", action="store_true", help="Only verify remote links without downloading")
    parser.add_argument("--download", "-d", action="store_true", help="Download datasets to target directory")
    parser.add_argument("--dem-only", action="store_true", help="Only process the primary DEM (skip hillshade)")
    parser.add_argument("--out-dir", "-o", default=None, help="Target directory for downloaded rasters")
    args = parser.parse_args()

    out_dir = args.out_dir if args.out_dir else get_default_output_dir()
    print("=" * 70)
    print("Lunar Landing Site Navigator — NASA LOLA Data Tools (HUM-02)")
    print(f"Target local raw directory: {out_dir}")
    print("=" * 70)

    items = DATASETS
    if args.dem_only:
        items = {"LDEM_80S_80MPP_ADJ.TIF": DATASETS["LDEM_80S_80MPP_ADJ.TIF"]}

    if args.verify_only or (not args.download):
        print("\nRunning remote repository verification:")
        all_ok = True
        for name, meta in items.items():
            ok = verify_remote_url(name, meta)
            all_ok = all_ok and ok
        
        if not args.download:
            print("\nHint: To download these files locally, run:")
            print("    python data/scripts/download_data.py --download")
            print("or set LUNAR_DEM_PATH environment variable.")
            return 0 if all_ok else 1

    if args.download:
        all_ok = True
        for name, meta in items.items():
            ok = download_file(name, meta, out_dir)
            all_ok = all_ok and ok
        return 0 if all_ok else 1

    return 0

if __name__ == "__main__":
    sys.exit(main())
