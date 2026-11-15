"""Identity-bound publication of the three reviewed native LOLA meshes.

This attests coordinate/datum mapping, NOT complete/global skyline visibility.
No publisher checksum is invented. See docs/science/TERRAIN_SCIENCE_REVIEW.md.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import os
import shutil

ROOT = Path(__file__).resolve().parents[1]
REVIEW_ID = 'PR15-BARKER2023-LDEM80S80-2026-11-15'
DEM_SHA = '82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a'
DEM_SIZE = 189158392
PROJECTION = {'name':'south-polar-stereographic','projDefinition':'+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m +no_defs','sourceFrame':'MOON_ME','linearUnit':'m'}
PATCHES = {
 'connecting-ridge': {'point':[-89.45,-137.31], 'origin':[-11308.18777098865,-12258.857997599333,1926.098388671875], 'bounds':[-16320,-17280,-6240,-7200], 'sha':'c2135ab984b8a4ac7ea80d907a38fb381f31a43da6b8cb034faf9c7e6f261851','bytes':884556,'label':'Connecting ridge · exploratory patch'},
 'near-shackleton': {'point':[-89.9,0], 'origin':[0,3032.3358121667407,622.2012329101562], 'bounds':[-5040,-2000,5040,8080], 'sha':'c0deeb10fd145ffea8191077d5b563af3b31608693adcac1fcdd75b9164a117f','bytes':884516,'label':'Near Shackleton · exploratory patch'},
 'near-de-gerlache': {'point':[-88.7,-68], 'origin':[-36551.48529118464,14767.758650866574,1739.0252685546875], 'bounds':[-41600,9760,-31520,19840], 'sha':'42ea98eeb08a9b437ad6f14bad553a30db85edd8c499128b12b2b374e9e26f58','bytes':884556,'label':'Near de Gerlache · exploratory patch'},
}
SOURCES = ['https://pgda.gsfc.nasa.gov/products/90','https://ntrs.nasa.gov/citations/20230014419','https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/LDEM_80S_80M_FLOAT.LBL']


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()


def encoded(value):
    return (json.dumps(value, indent=2, allow_nan=False)+'\n').encode()


def metadata(site):
    p = PATCHES[site]; x,y,z = p['origin']; a,b,c,d = p['bounds']
    # Only the sample-centre extent has triangles; exclude the half-cell footprint skirt.
    return {'regionId':'lunar-south-pole','projection':dict(PROJECTION),
      'render':{'type':'projected-terrain','tileSize':256,'minZoom':0,'maxZoom':0,
       'boundsMeters':{'minX':a+40,'minY':b+40,'maxX':c-40,'maxY':d-40},
       'sceneTransform':{'originEastingM':x,'originNorthingM':y,'verticalOriginM':z,'validated':True}},
      'assets':{'terrainTemplate':None,'surfaceTemplate':None,'hillshadeTemplate':None,'demoMeshUrl':f'/static/{site}/terrain.glb'},
      'terrainDataset':{'id':'LDEM_80S_80MPP_ADJ','sourceResolutionMeters':80,'verticalReference':'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M','metadataVerified':True}}


def map_manifest(site):
    m=metadata(site)
    return {'schemaVersion':1,'metadata':m,'requiredAssets':[m['assets']['demoMeshUrl']]}


def catalog():
    return {'schemaVersion':1,'reviewId':REVIEW_ID,'sites':[
      {'id':name,'label':p['label'],'latitude':p['point'][0],'longitude':p['point'][1],
       'description':'Native 80 m LOLA patch coordinates; not an approved landing site or a suitability ranking.',
       'metadata':metadata(name)} for name,p in PATCHES.items()]}


def atomic_write(path, body):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.tmp')
    temporary.write_bytes(body); temporary.replace(path)


def checked_dem(path):
    path=Path(path).resolve(strict=True)
    if path.stat().st_size != DEM_SIZE or digest(path) != DEM_SHA:
        raise ValueError('DEM differs from the reviewed full NASA product; approval denied')
    return path


def prepare_runtime(dem, candidates=None, output=None):
    dem=checked_dem(dem)
    candidates=Path(candidates or ROOT/'.validation/release-assets').resolve(strict=True)
    output=Path(output or ROOT/'.validation/runtime-assets').resolve()
    if not output.is_relative_to(ROOT/'.validation'):
        raise ValueError('Generated approval assets must stay in this checkout .validation directory')
    spec=importlib.util.spec_from_file_location('asset_setup_review',ROOT/'scripts/asset-setup.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    proofs=[]
    # Verify everything before publishing any approval-bearing metadata.
    for site,p in PATCHES.items():
        folder=candidates/site;mesh=folder/'terrain.glb';manifest_path=folder/'terrain-manifest.json'
        m=json.loads(manifest_path.read_text())
        if mesh.stat().st_size != p['bytes'] or digest(mesh) != p['sha']:
            raise ValueError(f'{site}: mesh bytes differ from the reviewed artifact')
        if m.get('meshLocalOrigin') != p['origin'] or [m.get('centerLatDeg'),m.get('centerLonDeg')] != p['point']:
            raise ValueError(f'{site}: reviewed transform/coordinates differ')
        if m.get('sourceLocalSha256') != DEM_SHA or m.get('sampleCoordinates') != 'RasterPixelIsArea centres: tiepoint + half a pixel; no resampling':
            raise ValueError(f'{site}: source identity or native registration missing')
        proof=module.verify_mesh(mesh,m,dem)
        if not proof['all_vertices_match_native_samples'] or proof['vertex_count'] != 15876 or proof['triangle_count'] != 31250:
            raise ValueError(f'{site}: incomplete native proof')
        proofs.append({'site':site,'meshLocalSha256':p['sha'],'terrainManifestLocalSha256':digest(manifest_path),
          'mapManifestLocalSha256':hashlib.sha256(encoded(map_manifest(site))).hexdigest(),
          'nativeVertexProof':{**proof,'sceneOriginMeters':p['origin'],'sampleBoundsProjectedMeters':metadata(site)['render']['boundsMeters']}})
    output.mkdir(parents=True,exist_ok=True)
    for site in PATCHES:
        target=output/'static'/site/'terrain.glb';target.parent.mkdir(parents=True,exist_ok=True)
        temp=target.with_name(target.name+'.tmp');shutil.copyfile(candidates/site/'terrain.glb',temp);temp.replace(target)
        atomic_write(output/'metadata'/f'{site}-map.json',encoded(map_manifest(site)))
    atomic_write(output/'metadata/map-manifest.json',encoded(map_manifest('connecting-ridge')))
    atomic_write(output/'static/metadata/explorer-sites.json',encoded(catalog()))
    # Legacy static smoke URL remains an alias, with the same reviewed bytes.
    alias=output/'terrain/0/0/0.glb';alias.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(output/'static/connecting-ridge/terrain.glb',alias)
    receipt={'schemaVersion':1,'reviewId':REVIEW_ID,'demPath':str(dem),'sourceBytes':DEM_SIZE,'sourceLocalSha256':DEM_SHA,
      'publisherChecksumAvailable':False,'sourceFrame':'MOON_ME_DE421','heightDefinition':'radial_distance_m_minus_1737400',
      'approvalScope':['radial-height-datum','native-mesh-coordinate-mapping'],'globalSkylineCompletenessVerified':False,
      'physicalGroundTruthVerified':False,'sources':SOURCES,'patches':proofs,'texture':None}
    atomic_write(output/'.release-review.json',encoded(receipt))
    validate_runtime(output)
    atomic_write(output/'compose.env', (f'ASSETS_DIR={output}\nDEM_DIR={dem.parent}\nDEM_CONTAINER_PATH=/dem/{dem.name}\nMAP_REVIEW_CONFIRMED=true\n').encode())
    return output


def validate_runtime(output):
    output=Path(output).resolve(strict=True)
    receipt=json.loads((output/'.release-review.json').read_text())
    if receipt.get('reviewId') != REVIEW_ID or receipt.get('sourceLocalSha256') != DEM_SHA or receipt.get('sourceBytes') != DEM_SIZE or receipt.get('globalSkylineCompletenessVerified') is not False or receipt.get('physicalGroundTruthVerified') is not False:
        raise ValueError('Runtime approval receipt is not this reviewed product')
    checked_dem(receipt['demPath'])
    for site,p in PATCHES.items():
        mesh=output/'static'/site/'terrain.glb'
        if mesh.is_symlink() or not mesh.resolve().is_relative_to(output) or mesh.stat().st_size != p['bytes'] or digest(mesh) != p['sha']:
            raise ValueError(f'{site}: published asset identity mismatch')
        expected=encoded(map_manifest(site)); actual=(output/'metadata'/f'{site}-map.json').read_bytes()
        if actual != expected:
            raise ValueError(f'{site}: published metadata does not match reviewed coordinates')
        proofs=receipt.get('patches',[])
        proof=next((item for item in proofs if item.get('site')==site),{})
        if proof.get('meshLocalSha256') != p['sha'] or proof.get('mapManifestLocalSha256') != hashlib.sha256(expected).hexdigest() or proof.get('nativeVertexProof',{}).get('all_vertices_match_native_samples') is not True:
            raise ValueError(f'{site}: missing bound native proof')
    if (output/'metadata/map-manifest.json').read_bytes() != encoded(map_manifest('connecting-ridge')) or (output/'static/metadata/explorer-sites.json').read_bytes() != encoded(catalog()):
        raise ValueError('Published map/catalog differs from the reviewed version')
    if digest(output/'terrain/0/0/0.glb') != PATCHES['connecting-ridge']['sha']:
        raise ValueError('Legacy alias differs from reviewed mesh')
    return receipt


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dem',type=Path,default=ROOT/'data/raw/LDEM_80S_80MPP_ADJ.TIF')
    parser.add_argument('--candidates',type=Path,default=ROOT/'.validation/release-assets')
    parser.add_argument('--output',type=Path,default=ROOT/'.validation/runtime-assets')
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    if args.check:
        receipt=validate_runtime(args.output); print('Reviewed runtime assets: PASS; global visibility remains unknown')
    else:
        print('Published reviewed coordinate/datum assets:',prepare_runtime(args.dem,args.candidates,args.output))
    return 0

if __name__=='__main__':
    try:raise SystemExit(main())
    except (OSError,ValueError,KeyError) as error:raise SystemExit('Runtime asset approval denied: '+str(error))
