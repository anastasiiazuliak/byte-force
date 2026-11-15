"""Structural and compressed-block validation for the official regional BigTIFF."""
import json
import math
from pathlib import Path
import struct
import zlib
from acquisition import sha256

EXPECTED = 189158392
URL = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF'


def validate_dem(path, expected_bytes=EXPECTED, regional_dem=True, source_url=URL):
    path = Path(path)
    size = path.stat().st_size
    if size != expected_bytes:
        raise ValueError(f'Incomplete DEM: {size} != {expected_bytes}')
    with path.open('rb') as source:
        def read(offset, length):
            if offset < 0 or length < 0 or offset+length > size:
                raise ValueError('TIFF pointer outside file')
            source.seek(offset)
            raw = source.read(length)
            if len(raw) != length:
                raise ValueError('Truncated TIFF structure')
            return raw
        header = read(0, 16)
        endian = '<' if header[:2] == b'II' else '>' if header[:2] == b'MM' else None
        if not endian or struct.unpack(endian+'HHH', header[2:8]) != (43, 8, 0):
            raise ValueError('Expected BigTIFF header')
        offset = struct.unpack(endian+'Q', header[8:])[0]
        seen, levels = set(), []
        while offset:
            if offset in seen or len(seen) >= 32:
                raise ValueError('Cyclic/excessive TIFF IFD chain')
            seen.add(offset)
            count = struct.unpack(endian+'Q', read(offset, 8))[0]
            if count > 4096:
                raise ValueError('Excessive IFD entries')
            entries = read(offset+8, count*20)
            tags = {}
            formats = {1:'B', 2:'c', 3:'H', 4:'I', 5:'Q', 7:'B', 11:'f', 12:'d', 16:'Q', 17:'q'}
            for i in range(count):
                entry = entries[i*20:(i+1)*20]
                tag, kind, n = struct.unpack(endian+'HHQ', entry[:12])
                if kind not in formats or n > 1000000:
                    raise ValueError('Unsupported TIFF field')
                fmt = formats[kind]
                length = struct.calcsize(fmt)*n
                raw = entry[12:12+length] if length <= 8 else read(struct.unpack(endian+'Q', entry[12:])[0], length)
                tags[tag] = raw.rstrip(b'\0').decode('ascii') if kind == 2 else list(struct.unpack(endian+str(n)+fmt, raw))
            required_samples = {258:[32], 339:[3], 277:[1]} if regional_dem else {277:[1]}
            for tag, value in required_samples.items():
                if tags.get(tag) != value:
                    raise ValueError(f'Unexpected sample tag {tag}')
            bits = tags[258][0]
            if bits not in (8,16,32):
                raise ValueError('Unsupported sample width')
            if tags.get(259) not in ([8], [32946]) or tags.get(317, [1]) not in ([1], [2], [3]):
                raise ValueError('Unsupported compression/predictor')
            offsets, lengths = tags.get(324), tags.get(325)
            if not offsets or not lengths or len(offsets) != len(lengths):
                raise ValueError('Missing/inconsistent tile index')
            width, height = tags[256][0], tags[257][0]
            tw, th = tags[322][0], tags[323][0]
            if not (0 < width <= 100000 and 0 < height <= 100000 and
                    0 < tw <= 4096 and 0 < th <= 4096):
                raise ValueError('Unsafe TIFF raster/tile dimensions')
            decoded_bytes = tw*th*(bits//8)
            if decoded_bytes > 16*1024*1024:
                raise ValueError('Excessive decoded TIFF tile size')
            if len(offsets) != math.ceil(width/tw)*math.ceil(height/th):
                raise ValueError('Incorrect tile count')
            for start, length in zip(offsets, lengths):
                if not 0 < length <= 16*1024*1024:
                    raise ValueError('Excessive compressed TIFF tile size')
                compressed = read(start, length)
                decoder = zlib.decompressobj()
                raw = decoder.decompress(compressed, decoded_bytes+1)
                if len(raw) != decoded_bytes or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
                    raise ValueError('Invalid/truncated Deflate tile')
            levels.append({'width': width, 'height': height, 'tiles_validated': len(offsets),
                           'tags': {str(k):v for k,v in tags.items() if k not in (324,325)}})
            offset = struct.unpack(endian+'Q', read(offset+8+count*20, 8))[0]
    tags = levels[0]['tags']
    expected_tags = {'256':[7600], '257':[7600], '33550':[80.,80.,0.], '33922':[0.,0.,0.,-304000.,304000.,0.]} if regional_dem else {}
    for tag, value in expected_tags.items():
        if tags.get(tag) != value:
            raise ValueError(f'Unexpected regional geotag {tag}: {tags.get(tag)}')
    if '34735' not in tags or (regional_dem and '42113' not in tags):
        raise ValueError('Missing geokeys / explicit nodata')
    if regional_dem:
        keys = tags['34735']
        geokeys = {keys[i]: keys[i+1:i+4] for i in range(4, len(keys), 4)}
        for key, wanted in {1025:[0,1,1], 3075:[0,1,15], 3076:[0,1,9001]}.items():
            if geokeys.get(key) != wanted:
                raise ValueError(f'Unexpected projection geokey {key}')
        if tags.get('34736') != [-90.,0.,1.,0.,0.,1737400.,1737400.,0.]:
            raise ValueError('Unexpected lunar stereographic parameters')
        if 'Moon (2015)' not in tags.get('34737',''):
            raise ValueError('Unexpected lunar CRS citation')
    return {'path': str(path.resolve()), 'source_url': source_url, 'actual_bytes': size,
            'local_sha256': sha256(path), 'publisher_checksum_available': False,
            'checksum_note': 'Local identity hash only, not publisher verification; no checksum found in consulted official catalogs.',
            'structural_validation_passed': True, 'all_deflate_tiles_validated': True,
            'levels': levels, 'nodata': tags.get('42113', 'not declared'),
            'scientific_review_confirmed': False}
