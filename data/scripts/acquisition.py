"""Bounded, identity-checked HTTP range acquisition (stdlib only)."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path

import time
import urllib.request


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def acquire(url, destination, expected_bytes, workers=4, chunk_size=262144,
            timeout=35, attempts=4, publisher_sha256=None, validate=None):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    def request(headers, method='GET'):
        return urllib.request.urlopen(urllib.request.Request(url, method=method, headers={
            'User-Agent': 'ByteForce-AssetAcquisition/2', 'Accept-Encoding': 'identity', **headers}), timeout=timeout)
    with request({}, 'HEAD') as response:
        identity = {'url': url, 'size': int(response.headers['Content-Length']),
                    'etag': response.headers.get('ETag'),
                    'last_modified': response.headers.get('Last-Modified')}
    if identity['size'] != expected_bytes:
        raise ValueError('Remote length differs from expected regional product')
    if not (identity['etag'] or identity['last_modified']):
        raise ValueError('Server provides no identity validator')
    def fetch(start, end):
        for attempt in range(attempts):
            try:
                headers = {'Range': f'bytes={start}-{end}'}
                etag = identity['etag']
                validator = etag if etag and not etag.startswith('W/') else identity['last_modified']
                if validator:
                    headers['If-Range'] = validator
                with request(headers) as response:
                    if response.status != 206:
                        raise ValueError('Server ignored Range / changed identity; refusing concatenation')
                    if response.headers.get('Content-Range') != f'bytes {start}-{end}/{expected_bytes}':
                        raise ValueError('Invalid Content-Range')
                    for key, header in [('etag', 'ETag'), ('last_modified', 'Last-Modified')]:
                        if identity[key] and response.headers.get(header) != identity[key]:
                            raise ValueError('Remote identity changed')
                    length = end-start+1
                    if int(response.headers.get('Content-Length', -1)) != length:
                        raise ValueError('Invalid Content-Length')
                    body = response.read(length+1)
                    if len(body) != length:
                        raise ValueError('Truncated or oversized range')
                    return body
            except Exception:
                if attempt + 1 == attempts:
                    raise
                time.sleep(min(2 ** attempt, 8))
    receipt_path = destination.with_name(destination.name + '.acquisition.json')
    if destination.exists() and destination.stat().st_size == expected_bytes and receipt_path.exists():
        previous = json.loads(receipt_path.read_text())
        if all(previous.get(key) == value for key, value in identity.items()) and previous.get('local_sha256') == sha256(destination):
            if publisher_sha256 and previous['local_sha256'].lower() != publisher_sha256.lower():
                raise ValueError('Publisher checksum mismatch')
            if validate:
                validate(destination)
            return previous
    part = destination.with_name(destination.name + '.part')
    state_path = part.with_name(part.name + '.json')
    # Legacy unreceipted bytes are reusable only after byte-for-byte remote proof.
    if destination.exists() and not part.exists():
        size = destination.stat().st_size
        if size > expected_bytes:
            raise ValueError('Local file exceeds remote product; preserved unchanged')
        with destination.open('rb') as stream:
            for start in range(0, size, chunk_size):
                end = min(size, start+chunk_size)-1
                if stream.read(end-start+1) != fetch(start, end):
                    raise ValueError('Legacy prefix differs from remote; preserved unchanged')
        os.replace(destination, part)
    state = json.loads(state_path.read_text()) if state_path.exists() else None
    if state and state['identity'] != identity:
        raise ValueError('Resume identity changed; partial preserved, not concatenated')
    if part.exists() and not state:
        size = part.stat().st_size
        with part.open('rb') as stream:
            for start in range(0, size, chunk_size):
                end = min(size, start+chunk_size)-1
                if stream.read(end-start+1) != fetch(start, end):
                    raise ValueError('Unreceipted partial differs from remote')
    offset = part.stat().st_size if part.exists() else 0
    if offset > expected_bytes:
        raise ValueError('Partial exceeds expected size')
    state_path.write_text(json.dumps({'identity': identity}))
    # Ordered writes retain a contiguous verified prefix even if a later worker fails.
    with part.open('ab') as output, concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(workers, 4))) as pool:
        ranges = [(start, min(start+chunk_size, expected_bytes)-1) for start in range(offset, expected_bytes, chunk_size)]
        for batch in range(0, len(ranges), max(1, min(workers, 4))):
            futures = [pool.submit(fetch, *bounds) for bounds in ranges[batch:batch+max(1, min(workers, 4))]]
            for future in futures:
                output.write(future.result())
                print(f'{output.tell()}/{expected_bytes} verified bytes', flush=True)
        output.flush()
        os.fsync(output.fileno())
    if part.stat().st_size != expected_bytes:
        raise ValueError('Final size mismatch')
    digest = sha256(part)
    if publisher_sha256 and digest.lower() != publisher_sha256.lower():
        raise ValueError('Publisher checksum mismatch')
    if validate:
        validate(part)
    receipt = {**identity, 'source_url': url, 'actual_bytes': expected_bytes,
               'local_sha256': digest, 'publisher_sha256': publisher_sha256,
               'checksum_note': 'Local SHA256 is identity evidence, not a publisher checksum.',
               'scientific_review_confirmed': False}
    os.replace(part, destination)
    destination.with_name(destination.name + '.acquisition.json').write_text(json.dumps(receipt, indent=2)+'\n')
    state_path.unlink(missing_ok=True)
    return receipt
