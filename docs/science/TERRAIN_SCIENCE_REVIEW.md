# Terrain scientific reference

Identity-bound review ID: **PR15-BARKER2023-LDEM80S80-2026-11-15**. The identifier is retained because runtime proofs refer to it; it is not a general approval of other assets.

**Decision:** the NTRS manuscript/PDS/PGDA generating-method chain closes the previously unmet vertical-definition criterion. The exact complete DEM below is now automatically approved for radial-height alignment after same-open-handle SHA-256 and full native geotag checks, with analysis applicability restricted to **1962-01-01T00:00:00Z ≤ UTC < 2650-01-01T00:00:00Z**. There is no operator boolean to approve another DEM. Regional horizon and regional clearance are returned, but global visibility and summaries remain unknown and status remains partial. All three specifically identified meshes below pass native vertex proof and are approved for their **projected coordinate/height mapping only**, conditional on deployment of those exact bytes and preservation of their transforms. This does not approve complete skyline visibility, site recommendations, physical accuracy ground truth, or non-overlapping LROC texturing.

## Evidence and identity (not a publisher checksum)

* NASA PGDA product 90, <https://pgda.gsfc.nasa.gov/products/90>, captured in `.validation/official-docs/0.{html,txt}`: “All TIF files are cloud-optimized GeoTiffs (COGs) with south polar stereographic X/Y coordinates in meters and in the MOON_ME reference frame of the JPL DE421 ephemeris.” The same page describes LDEM as “giving surface height (in meters)”. This is explicit source-frame evidence, not an inference from a generic Moon CRS name. The page identifies Barker et al. 2023, DOI <https://doi.org/10.3847/PSJ/acf3e1>.
* Product 81, <https://pgda.gsfc.nasa.gov/products/81>, capture `1.txt`: “MOON_ME reference frame of ephemeris DE421.” It describes different high-resolution products and must not independently certify this raster's vertical reference.
* Capture provenance and local hashes are in `.validation/official-docs/sources.json`. Original captures were not changed by this review.
* DEM: <https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF>, **189158392 bytes**, SHA-256 **82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a**. `.validation/release-assets/dem-receipt.json` explicitly says publisher checksum unavailable. This hash identifies the local artifact; do not call it an official checksum or independent authenticity proof.
* Receipt reports 310 Deflate tiles across four resolution levels. The native-reader C# test decompresses all **225 native/full-resolution** 512×512 tiles, not all overview levels. Python acquisition validation covers all 310. Seven native Float32 samples were independently reconstructed using Python stdlib `zlib`, inverse horizontal differencing and byte-plane reconstruction, and compared bit-for-bit with C#. `.validation/science-native-controls.json` records the controls. Examples: `(3800,3800)` = `1282.298095703125` m, bits `44a0498a`; `(3500,3500)` = `-1315.710205078125` m, bits `c4a476ba`. This establishes decoder agreement, **not independent physical height accuracy**.

## Horizons frame, signs and height mathematics

Consulted NASA/JPL manual: <https://ssd.jpl.nasa.gov/horizons/manual.html>, sections “User-Defined Topocentric Site Coordinates”, “Lunar Mean-Earth Frame of DE421”, and observer quantity 4. Local review capture `.validation/science-horizons-manual.html`; URL and local identity hash in `.validation/science-source-receipts.json`.

Relevant exact excerpts:

> For other bodies, Horizons uses planetodetic/geodetic IAU coordinates (or mean Earth of DE421 for the Moon).

> Exceptions are the Earth, Moon and Sun ... positive longitude values are assumed to be eastward in this system due to historical precedence.

> ... a rotation by a fixed offet from the DE440 principal axis (or PA) system ... to the standard DE421 mean Earth frame.

The manual limits the high-precision lunar model to AD 1550–2650; outside it Horizons switches models. Do not silently apply a future alignment approval beyond its verified epoch range. The application's UTC input restriction alone does not enforce the upper bound.

An actual NASA observer-table response for `coord@301`, `GEODETIC`, `SITE_COORD=25,-89,0`, UTC `2026-11-14 00:00:00`, Sun target, quantity 4, `AIRLESS`, was saved in `.validation/science-horizons-control.json`. Header excerpts:

```text
Center geodetic : 25.0, -89.0, -1.9299E-13        {E-lon(deg),Lat(deg),Alt(km)}
Center pole/equ : MEAN_ME (high precision)        {East-longitude positive}
Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}
```

The approximately zero printed height is numerical noise. `DE441` in the center-body trajectory header does not contradict the manual's DE421 mean-Earth orientation definition: translational ephemeris and body-fixed frame realization are different things.

For a reference ellipsoid, `tan(phi_c) = (b²/a²) tan(phi_g)` on the surface. Here all three radii are equal, so reference-surface planetographic/geodetic and planetocentric latitude agree; a radial height displacement preserves that direction. This does **not** assert that terrain slope normals equal sphere normals, or that an arbitrary lunar geoid/ellipsoid height is a radial height.

### Closed vertical-definition criterion: authoritative generating-method chain

Optional local evidence includes the page-preserving manuscript extraction and predecessor label under `.validation/vertical-review/`. Authoritative sources:

1. NASA NTRS <https://ntrs.nasa.gov/citations/20230014419>, accepted manuscript with final changes <https://ntrs.nasa.gov/api/citations/20230014419/downloads/BarkernewviewSTIupdated.pdf>, Barker et al. 2023, DOI <https://doi.org/10.3847/PSJ/acf3e1>.
   * **Printed/PDF p. 4 Table 1:** `LDEM_80S_80M` → `LDEM_80S_80MPP_ADJ`, 80 m/pix. This is the exact product mapping, not an analogy to a different DEM.
   * **p. 11 lines 208–211:** “This geolocation uncertainty applies to total absolute position rather than the uncertainty in a DEM pixel’s surface height (i.e., elevation above the reference sphere), which we examine next.”
   * **p. 5 lines 135–138:** “The cleaned point cloud tiles are then individually aligned to the original LDEM with a 3-D translation ... This step preserves the overall geodetic accuracy of the map”. Lines 139–140 report nonzero radial corrections: the heights are **not** unchanged predecessor values.
   * **p. 6 lines 148–155:** offsets applied to other polar products and multi-pixel averaging to 40/60/**80**/120/240 m/pix preserve representative pixel heights. For normalized weights, `sum(w_i*(r_i-R)) = sum(w_i*r_i)-R`; adjustment and interpolation do not imply a new vertical datum.
   * **p. 3 lines 98–100:** polar products use the stereographic projection in MOON_ME/DE421. Figure 1's projection radius corroborates the horizontal model but is not used alone as vertical proof.
2. Official LOLA PDS label <https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/LDEM_80S_80M_FLOAT.LBL>, captured as `.validation/vertical-review/LDEM_80S_80M_FLOAT.LBL`, `PRODUCT_ID=LDEM_80S_80M`:
   > Map values are relative to a radius of 1737.4 km.

   > Each sample represents height relative to a reference radius (OFFSET)

   Its IMAGE block states `UNIT=KILOMETER`, `SCALING_FACTOR=1`, `OFFSET=1737.4`, and explicitly defines `PLANETARY_RADIUS = (DN * SCALING_FACTOR) + OFFSET`, “where OFFSET is the radius of a reference sphere.” It distinguishes this from geoid-relative topography. These **old IMG encoding units are not applied to the adjusted TIF**.
3. Exact-family PGDA product 90 supplies the new TIF's surface-height unit **meters** and links the generating paper. Actual TIF header/sample metadata and whole-file identity establish the encoding used here.

Together these justify `r_m = 1737400 + h_TIF_m` and Horizons altitude **`h_TIF_m/1000` km**, rather than applying a geoid correction or the old label's kilometer scale. This is a scientific-definition/method conclusion, not an independent measurement of height accuracy or a claim of zero geolocation error. Local capture hashes (not publisher checksums) are recorded in `.validation/vertical-review/receipts.json`; manuscript PDF local SHA-256 `c6ce5e34174e1a99274a67cdff861e1a74e73f321e49f78b3fed6c888149dd8b`, predecessor label `ad49a34be1b95a66b4bb2e12c46050cead656f6e97dc4e7d5d2c6900d51595b9`.

### Enforced identity/metadata/epoch policy

`LolaTiffReader.Open` checks the parsed native dimensions (7600²), 512² tiles, Float32 single-band Deflate/predictor 3, PixelIsArea, NaN NoData, exact pixel scales/tiepoint, the complete native GeoKey directory, projection/radius/offset GeoDouble parameters, and the full CRS citation. It then requires **189158392 bytes and the exact SHA-256 below**, hashing the **same opened file handle** used to read pixels. Filename, caller flags, and local receipt assertions cannot approve another product. An altered payload, altered geotags, or truncated file does not receive approval. The configured API height adapter recognizes only this checked concrete service and supplies `HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M`; arbitrary providers claiming alignment are not trusted by that adapter.

The raw terrain service itself deliberately remains unaligned: only the reviewed configured adapter maps its datum to Horizons. `AnalysisService` applies the period gate before resolving altitude or requesting a horizon. A period ending at/after **2650-01-01** is conservatively unreviewed in full; it uses zero reference-sphere altitude and returns no terrain clearance. This exclusive cutoff avoids assuming an exact within-year model transition from the manual's year-level description. Earlier than 1962 is already rejected by UTC request validation. At the exact South Pole, azimuth-dependent analysis remains unknown pending a reviewed meridian convention.

Approval is computed at open time. Deploy DEMs as immutable/read-only assets; do not modify an opened file in place. Atomic replacement requires a new service/process opening and reviewing the new handle. There is no claim of protection against a privileged hostile writer modifying approved bytes after verification.

## Projection, native sampling and horizon model

Actual native GeoKeys specify spherical polar stereographic (method 15), south-pole latitude −90°, longitude 0°, scale 1, false offsets 0; GeoDouble values include both axes 1737400 m. GeoTransform tiepoint is `(−304000,+304000)` m, scale 80 m, raster 7600². `GTRasterTypeGeoKey=1` means PixelIsArea. Hence native sample `[c,r]` is at:

```text
x = -304000 + 80(c + 1/2)
y =  304000 - 80(r + 1/2)
```

The backend now reads the raster-type GeoKey and accounts for the half-pixel offset rather than treating a cell corner as its center. Synthetic fixtures without this GeoKey retain their legacy point-grid convention. The parser is **not** a general GeoTIFF reprojection engine: horizontal extent/radius/scale metadata are still product defaults. Arbitrary configured files remain unapproved. The current known-product policy binds the actual opened asset's identity and validated full native geotags to the review; it does not accept a boolean claiming approval.

Stereographic coordinates use `rho=2R tan((90°+latitude)/2)`, `x=rho sin(longitude)`, `y=rho cos(longitude)`. East-positive longitude increases toward +X on the 0° meridian. Local scale is `sec²(colatitude/2)`: at 80°S it is about 1.00765, not exactly one. Previously straight projected rays and `psi=projected_distance/R` mixed map distance with surface distance. Rays now follow great circles using Cartesian north/east tangent bases, project each destination to the raster, and use **surface arc distance** for `psi`. Snapped window origins are carried explicitly so observer offsets from the nearest pixel are retained. The window allocation includes a 2% projection-scale margin over the supported south-polar region and 60 km maximum range; it is not a universal projection bound.

### Consistent observer/ray interpolation

`BilinearDemSurface.TrySample` now defines **both** the observer height returned by `LolaTerrainService.GetElevationAsync` and the DEM heights sampled along horizon rays. The previous nearest-pixel/centimeter-rounded observer height was inconsistent with bilinear ray heights: on sloping terrain it could introduce a spurious first-step height difference and a high near-field horizon. Point lookup no longer uses `Math.Round` to choose the height pixel and does not round the result to 0.01 m. The rounded pixel used to center a raster **window** is unchanged; its explicit projected origin still positions the observer correctly within that window.

For fractional sample coordinates `(c+u,r+v)`, height is `(1-u)(1-v)h00 + u(1-v)h10 + (1-u)v h01 + uv h11`. Sampling is limited to the **closed sample-center domain** `[0,width-1] × [0,height-1]`; the outer half-pixel footprint is not extrapolated or clamped. Exact native centers return the original Float32 height promoted to double. At a border/center, exactly zero-weight neighbors are not read and cannot poison a valid sample with `0*NaN`. Every positively weighted corner must be finite, including a tiny positive weight; missing values are never dropped and weights are never renormalized. There is no snapping tolerance that admits exterior points or suppresses a positively weighted NoData corner. Inverse-projection floating-point roundoff can conservatively reject a point infinitesimally outside support rather than extrapolate it.

The same local helper handles observer and ray interpolation; radial curvature and geodesic destinations remain as described below. Analytic linear-plane tests cover fractional pixels, native centers and edges; a generated sparse synthetic BigTIFF verifies the actual service's unrounded observer height and first 80 m horizon step against the linear-plane/spherical-angle formula. This is a consistent **80 m DEM interpolant**, not subpixel physical terrain knowledge: extra output digits are computational precision, not additional measurement accuracy. All real-source native pixel hashes/Float32 controls and mesh proof identities remain unchanged.

For observer radial distance `r0=R+h0+offset` and sample radial distance `rs=R+hs`, the local geometric obstruction angle is:

```text
alpha = atan2(rs cos(psi) - r0, rs sin(psi)), psi = surface_distance/R
```

On a constant-radius sphere with zero observer offset, this reduces exactly to `alpha=-psi/2`. Flat-sphere synthetic tests exercise curvature; pole/cardinal analytic controls exercise longitude signs; independent spherical-cosine distances exercise nonpolar geodesics. These are mathematical controls, not NASA-measured horizon ground truth.

The production horizon default is **20 km**, 1° azimuth spacing, 80 m radial step; API composition sets observer offset to 0 m (standalone service default is 2 m). The real-DEM science test also exercises a **5 km** profile. Neither radius guarantees a complete physical horizon. At 5 km, equal-height spherical curvature drop is about 7.2 m; at 20 km, about 115 m. More distant high terrain can therefore still matter. Finite angular/radial sampling can miss narrow ridges, bilinear interpolation smooths peaks, and 80 m pixel spacing is not a guarantee of effective terrain resolution or vertical accuracy. There is no reviewed global upper-height envelope, far-field skyline, or discretization error bound here. A warning explicitly states that clear sampled rays are not proof of global visibility. `HorizonProfileResult.TerrainApplied` means the requested sampled window completed without gaps, **not** that global line-of-sight completeness has been certified.

NoData, nonfinite values, clipped rays and compute-budget exhaustion prevent successful sampled-profile application; no fabricated −90° horizon is emitted for unsampled rays. Declared finite NoData values are normalized to NaN. The raw terrain height service does not assert datum alignment from defaults; the configured adapter approves only the known product. Every successful LOLA profile carries an internally set `IsRegionalOnly` provenance marker. This marker is not an HTTP/configuration switch and is separate from the requested window's successful sampling flag.

For a reviewed in-era dataset and a complete valid 360° **regional** profile, the frozen API returns the actual `horizon.points` (unless `includeHorizon=false`) and per-target `horizonDeg` plus **regional** `clearanceDeg=elevationDeg-horizonDeg`. It deliberately keeps **all `visible` values null**, even for negative clearance; this conservative choice avoids presenting sampled/interpolated obstruction as an independently certified physical blocker. Global summaries stay null, visibility intervals are empty/unknown (not a claim of zero visible time), `status=partial`, and `quality.terrainApplied=false`. A prominent warning explains that this false value means no complete visibility solution, not absence of actual DEM sampling. `visibilityMethod` explicitly identifies the finite-range regional skyline and unknown global visibility.

Clipped, NoData-contaminated, timed-out, mismatched-source/resolution, or insufficient-azimuth profiles cannot supply interpolated API clearances: their horizon/clearance remain null with warnings. Unreviewed DEMs and out-of-era requests retain the prior safe unknown behavior. No production finite-range LOLA path can yield `visible=true`, complete summaries, or `status=complete`. The existing fully trusted synthetic provider tests retain their original semantics; they do not certify the real DEM's far field.

## Apparent disc center, not power or exact rise/set

This is a geometric terrain-obstruction test applied to **airless apparent disc-center** directions from Horizons quantity 4. “Geometric” describes the terrain line-of-sight construction, **not** an instantaneous uncorrected celestial vector. The manual defines quantity 4 as adjusted for light-time, gravitational deflection, stellar aberration, precession and nutation. `AIRLESS` removes atmospheric refraction; it does not remove apparent-position corrections. Azimuth is north→east. Non-Earth atmospheric refraction is not modeled.

No solar limb/finite-disc illumination fraction, irradiance, panel orientation, slope illumination, thermal model, dust, radio diffraction/link budget, or power prediction is supplied. Horizons rise/set markers use upper limbs for Sun/Moon and are not interchangeable with this center-of-disc comparison. Interval crossings use linear interpolation in sampled clearance, not an exact event solver.

## Untrusted-file memory/security changes

Before allocations: ≤4096 IFD entries; ≤1,000,000 array entries/tiles; raster axes ≤1,000,000; decoded tile and compressed payload ≤16 MiB each. Tile grid products are calculated in 64-bit arithmetic. Reject unsupported array element types, non-scalar dimensions/layout tags, invalid BigTIFF header fields, non-Float32/non-single-band/non-Deflate layouts and unsupported predictors. No missing-dimension fallback fabricates a valid index. Missing predictor uses TIFF's no-predictor default. Compressed output must have exactly the declared decoded size. The tile cache is capped at 64 MiB of sample payload and decoding is serialized to prevent concurrent cache misses multiplying scratch allocations. Reader windows are limited to 4,000,000 pixels; service windows to radius 999 pixels. These are per-reader bounds, not a process-wide HTTP admission-control guarantee. Existing positional-I/O bounds checks and corrupt/truncated-payload rejection remain.

## Runtime configuration and asset identity

### DEM/API: automatic known-product review, no boolean override

API content root: `backend/LunarNavigator.Api`. Configure:

```json
{
  "Terrain": {
    "DemPath": "../../data/raw/LDEM_80S_80MPP_ADJ.TIF"
  },
  "MapManifest": {
    "MetadataReviewConfirmed": false
  }
}
```

The equivalent environment key is `Terrain__DemPath`; set it to the source path in your checkout. The existing `LUNAR_DEM_PATH` fallback also works. Alignment now automatically activates **only** for the reviewed identity/geotags above, irrespective of map metadata review configuration. A regenerated/repacked TIF with different bytes is unapproved even if scientifically equivalent: it needs its own identity/metadata review. There is no `DatumAlignmentVerified` configuration setting and no receipt containing `approved=true` that can bypass this check.

### Scoped mesh/picking approval and deployment receipt

`ReviewedMeshNativeProofTests` independently checked all **15,876 vertices per mesh / 47,628 total** using the C# native reader for the reviewed DEM. Every projected X/Y sample center and absolute radial height agrees within **0.001 m** after applying the declared scene origin; the checks also pin GLB identity, basic GLB/accessor layout, no hidden node transforms, and 93,750 indices per mesh. Existing acquisition mesh-validation receipts provide additional structure checks. This is **native asset/coordinate consistency**, not independent physical ground truth or guaranteed DEM accuracy.

The following exact artifacts are approved for local projected-coordinate/height picking when the deployment preserves their declared transforms and restricts picking to actual mesh triangles, not a fallback plane outside the mesh:

| Patch | GLB SHA-256 (local identity) | Scene origin: easting, northing, radial-height offset (m) |
|---|---|---|
| connecting-ridge | `c2135ab984b8a4ac7ea80d907a38fb381f31a43da6b8cb034faf9c7e6f261851` | `[-11308.18777098865, -12258.857997599333, 1926.098388671875]` |
| near-shackleton | `c0deeb10fd145ffea8191077d5b563af3b31608693adcac1fcdd75b9164a117f` | `[0, 3032.3358121667407, 622.2012329101562]` |
| near-de-gerlache | `42ea98eeb08a9b437ad6f14bad553a30db85edd8c499128b12b2b374e9e26f58` | `[-36551.48529118464, 14767.758650866574, 1739.0252685546875]` |

Current input manifest identities (the original map manifests still have review flags **false**):

| Patch | terrain-manifest.json SHA-256 | current map-manifest.json SHA-256 |
|---|---|---|
| connecting-ridge | `1af4b2dfce094b54003a0928ffaa30850ada190612f04bcd2b7d5e488a81b698` | `b8fc238448db6e7a8eb1f87f32211fab3fc48aeac1cf7510c4a8049746b2ef18` |
| near-shackleton | `604c626609f1e1d607507223c387c4e6499be07b5d3f10137dd7e93d8b8ed23c` | `f776abfcfa8590f6233a3ac3e7693abc0b044e46e65dae7f5484ebb9b17b9649` |
| near-de-gerlache | `a10cbfd8fa022d2260d99de0bdd180a2fc3a099895882acb26da592dffe95a5f` | `2bac9f4fd54bd3a8af1174c1ba4ab0f0130bfe69d6928e9739b395fff5841a09` |

These pin the reviewed **input** metadata, not the published runtime manifests. Runtime publication changes URLs and metadata flags and therefore requires new final hashes. `scripts/asset-setup.py --prepare-runtime` and `scripts/release_assets.py` bind the deployment to the source and native mesh proofs. `scripts/run-local.py` validates the published receipt before enabling reviewed map configuration. See [asset acquisition](ASSET_ACQUISITION.md) for supported commands.

For new meshes, approval does not follow from the source filename or copying an old receipt. Require the same source DEM identity, complete native vertex/triangle/transform validation against actual samples (including PixelIsArea), no NoData substitution, manifest/source/mesh hash binding and boundary-limited picking. The fixed-current-mesh C# test intentionally rejects different mesh hashes; new artifacts need a dedicated proof. Source consistency remains separate from global visibility. The acquired NAC image does not overlap these patches; do not apply it as their photographic texture. The separate default polar-cap cartographic relief averages native DEM heights and derives gradient shading; it is not photography, does not displace geometry and does not change this review's regional-only/unknown-global visibility policy. Its exact artifact identity and Python build requirements are documented in [asset acquisition](ASSET_ACQUISITION.md#default-polar-cartographic-relief).

## Reproducible scientific controls

`ReviewedMeshNativeProofTests` checks current native mesh identities and vertex mapping. `RealTerrainScienceTests` exercises the identified DEM and regional analysis; these checks are opt-in rather than proof supplied by ordinary synthetic CI. Local evidence includes native Float32 control samples, source captures and bilinear model outputs. Optional ignored receipts may be absent on a fresh clone; source URLs and identity requirements above remain the scientific reference.

For real-source tests, set `SCIENCE_REAL_DEM` to the identified TIFF and `SCIENCE_MESH_ROOT` to the generated `.validation/release-assets` directory. `SCIENCE_LIVE_API=1` separately enables NASA calls; `SCIENCE_LOG_DIRECTORY` optionally selects a local log directory. Then run `dotnet test backend/LunarNavigator.sln --no-restore -c Release`. Omit the live opt-in for offline testing. These settings select test inputs, not production approval overrides.

One recorded numerical control uses latitude −89°, longitude +25°, UTC 2026-11-14 00:00–00:10 with a 10-minute step. The bilinear observer height is −1075.1733520528821 m (Horizons altitude −1.0751733520528821 km). First Sun apparent elevation is 1.355011298°, regional horizon 10.868216436799301°, clearance −9.5132051387993°. First Earth elevation is −3.751226658°, regional horizon 7.6420759835053°, clearance −11.3933026415053°. Both global visibility values and summaries remain null, with partial status and `quality.terrainApplied=false`. These are recorded model outputs, not independent measured ground truth or a promise that a live upstream response is immutable.

Current validation results belong to the current test run, not to a historical pass count in this reference. No external deployment, global skyline completeness or physical site suitability is certified by these controls.
