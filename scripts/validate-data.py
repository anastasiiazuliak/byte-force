#!/usr/bin/env python3
"""Validate the regional DEM independently; receipt is not scientific approval."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = 189158392
URL = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dem', nargs='?', type=Path, default=ROOT / 'data/raw/LDEM_80S_80MPP_ADJ.TIF')
    args = parser.parse_args()
    path = args.dem.resolve()
    receipt = dict(source_url=URL, path=str(path), expected_bytes=EXPECTED,
                   timestamp_utc=datetime.now(timezone.utc).isoformat(),
                   publisher_checksum_available=False, scientific_review_confirmed=False)
    errors = []
    try:
        receipt['actual_bytes'] = path.stat().st_size
        digest = hashlib.sha256()
        with path.open('rb') as source:
            for block in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(block)
            receipt['local_sha256'] = digest.hexdigest()
            source.seek(0)
            header = source.read(16)
            endian = '<' if header[:2] == b'II' else '>' if header[:2] == b'MM' else None
            if not endian or struct.unpack(endian + 'HHH', header[2:8]) != (43, 8, 0):
                raise ValueError('Not a supported BigTIFF header')
            offset = struct.unpack(endian + 'Q', header[8:16])[0]
            source.seek(offset)
            count = struct.unpack(endian + 'Q', source.read(8))[0]
            if count > 4096:
                raise ValueError('Implausible BigTIFF IFD entry count')
            entries = {}
            for _ in range(count):
                entry = source.read(20)
                tag, kind, n = struct.unpack(endian + 'HHQ', entry[:12])
                entries[tag] = (kind, n, entry[12:20])
            def values(tag):
                kind, n, raw = entries[tag]
                fmt = {3: 'H', 4: 'I', 12: 'd', 16: 'Q'}[kind]
                length = struct.calcsize(fmt) * n
                if length > 8:
                    source.seek(struct.unpack(endian + 'Q', raw)[0])
                    raw = source.read(length)
                return list(struct.unpack(endian + str(n) + fmt, raw[:length]))
            tags = {str(tag): values(tag) for tag in (256, 257, 258, 259, 339, 33550, 33922, 34735)}
            receipt['bigtiff_tags'] = tags
            for tag, wanted in {256: [7600], 257: [7600], 258: [32], 339: [3]}.items():
                if tags[str(tag)] != wanted:
                    errors.append(f'Unexpected TIFF tag {tag}')
            if tags['259'] not in ([8], [32946]):
                errors.append('Expected Deflate compression')
            if tags['33550'][:2] != [80.0, 80.0]:
                errors.append('Expected 80 metre pixel scale')
        if receipt['actual_bytes'] != EXPECTED:
            errors.append('Incomplete or unexpected file size')
    except (OSError, ValueError, KeyError, struct.error) as error:
        errors.append(str(error))
    receipt.update(errors=errors, structural_validation_passed=not errors,
                   checksum_note='Local identity hash only; no publisher reference checksum exists. Header checks do not validate all pixels or scientific suitability.')
    output = ROOT / '.validation/dem-receipt.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(main())
