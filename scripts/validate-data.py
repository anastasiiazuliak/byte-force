#!/usr/bin/env python3
"""Validate the complete regional DEM; this is not scientific approval."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'data/scripts'))
from validation import validate_dem


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dem', nargs='?', type=Path, default=ROOT/'data/raw/LDEM_80S_80MPP_ADJ.TIF')
    parser.add_argument('--receipt', type=Path, default=ROOT/'.validation/dem-receipt.json')
    args = parser.parse_args()
    try:
        receipt = validate_dem(args.dem)
        acquisition = args.dem.with_name(args.dem.name+'.acquisition.json')
        if acquisition.exists():
            receipt['acquisition'] = json.loads(acquisition.read_text())
        receipt['errors'] = []
    except (OSError, ValueError, KeyError, EOFError, struct.error, zlib.error, UnicodeError) as error:
        receipt = {'path': str(args.dem.resolve()), 'errors': [str(error)],
                   'structural_validation_passed': False, 'scientific_review_confirmed': False}
    receipt['timestamp_utc'] = datetime.now(timezone.utc).isoformat()
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt, indent=2))
    return int(bool(receipt['errors']))


if __name__ == '__main__':
    sys.exit(main())
