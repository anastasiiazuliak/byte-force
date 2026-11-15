#!/usr/bin/env python3
"""Download official regional LOLA products with validated, resumable ranges."""
import argparse
import os
from pathlib import Path
import sys
import urllib.request
from acquisition import acquire
from validation import validate_dem

DATASETS = {
    'LDEM_80S_80MPP_ADJ.TIF': {
        'url': 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF',
        'description': 'Regional 80–90 S LOLA elevation, 80 m/px',
        'expected_bytes': 189158392,
    },
    'LDEM_80S_80MPP_ADJ_HILL.TIF': {
        'url': 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_HILL.TIF',
        'description': 'Derived hillshade; not camera imagery',
        'expected_bytes': 88474342,
    },
}


def get_default_output_dir():
    if os.environ.get('LUNAR_DATA_DIR'):
        return os.environ['LUNAR_DATA_DIR']
    if os.environ.get('LUNAR_DEM_PATH'):
        return str(Path(os.environ['LUNAR_DEM_PATH']).resolve().parent)
    return str(Path(__file__).resolve().parents[1]/'raw')


def verify_remote_url(name, meta):
    try:
        with urllib.request.urlopen(urllib.request.Request(meta['url'], method='HEAD'), timeout=20) as response:
            print(name, dict(response.headers))
            return int(response.headers['Content-Length']) == meta['expected_bytes']
    except Exception as error:
        print(f'[ERROR] {error}')
        return False


def download_file(name, meta, dest_dir):
    try:
        if name == 'LDEM_80S_80MPP_ADJ.TIF':
            validator = validate_dem
        else:
            # No scientific claims for this optional visualization product.
            def validator(path):
                return validate_dem(path, meta['expected_bytes'], False, meta['url'])
        acquire(meta['url'], Path(dest_dir)/name, meta['expected_bytes'], workers=4,
                chunk_size=262144, timeout=20, validate=validator)
        return True
    except Exception as error:
        print(f'[ERROR] {error}; partial preserved')
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', '-v', action='store_true')
    parser.add_argument('--download', '-d', action='store_true')
    parser.add_argument('--dem-only', action='store_true')
    parser.add_argument('--out-dir', '-o', default=get_default_output_dir())
    args = parser.parse_args()
    items = list(DATASETS.items())[:1] if args.dem_only else list(DATASETS.items())
    results = []
    for name, meta in items:
        if args.verify_only or not args.download:
            results.append(verify_remote_url(name, meta))
        if args.download:
            results.append(download_file(name, meta, args.out_dir))
    return 0 if all(results) else 1


if __name__ == '__main__':
    sys.exit(main())
