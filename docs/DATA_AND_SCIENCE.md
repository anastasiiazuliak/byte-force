# Data and science

## Source and attribution

The reviewed terrain source is NASA Goddard PGDA [product 90](https://pgda.gsfc.nasa.gov/products/90), *A New View of the Lunar South Pole from LOLA*: `LDEM_80S_80MPP_ADJ.TIF`, 80 m pixels, 80–90°S, MOON_ME / DE421 mean-Earth frame. Cite **Barker et al. (2023), The Planetary Science Journal 4, 183**, [doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1); data DOI **10.60903/gsfcpgda-lola-spole**.

Exact source identity: **189,158,392 bytes**, local SHA-256 `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`. This is a local identity hash, **not an official publisher checksum**. Source metadata and bytes are checked together; a filename or approval flag cannot approve a different raster.

The generating-method chain establishes radial height in metres above the **1,737,400 m** lunar reference sphere. It does not establish independent ground-truth accuracy. The adjusted TIFF is not encoded in the predecessor PDS IMG's kilometre units. See the [terrain scientific reference](science/TERRAIN_SCIENCE_REVIEW.md) for evidence, identities and policy.

NASA/JPL [Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) supplies topocentric airless apparent disc-center angles. Earth artwork used in the explorer is credited in source to **NASA/Goddard Space Flight Center Scientific Visualization Studio, SVS 2915**. The whole-globe SVS context is muted and is not verified polar photography. The polar cap instead uses a DEM-derived cartographic material. Default runtime preparation builds a verified 2048² RGBA relief texture from native sample averages and gradients at 296.875 m projected cell spacing, not a photo or additional geometry displacement. Exact artifact/source identities are in [asset acquisition](science/ASSET_ACQUISITION.md#default-polar-cartographic-relief).

Camera-anchored Sun/Earth ornaments are removed; before Analyze there are no sky bodies. Globe direction markers require a real, exact cached Analyze sample with JPL provenance, verified Globe geometry and finite observer height. At the shared UTC and optional Site A/B reference, airless apparent azimuth/elevation is converted through ENU and Moon_ME to scene `(Y, -Z, -X)`. Directions are world-fixed, not camera-anchored. Short arrows at the selected site indicate actual bearing.

Real orbital distances are unavailable in the canonical API. The 8R endpoint distance and symbol radii are display-only: they do not represent actual celestial positions, phase or physical scale. Markers can be offscreen or occluded and are not forced always onscreen. TerrainView uses a compass and cached Sun lighting, not global vector endpoints or a globally accurate illumination solution. Star placement is not an observed catalog. These visuals do not change unknown scientific visibility.

Official [LROC imagery](https://lroc.im-ldi.com/images/downloads) and the PGDA-linked NAC image `M1188426614LE_20MPP.TIF` are separate sources. The acquired NAC footprint does **not** overlap the three generated patches; it is not applied as their texture. DEM hillshade is a derived visualization, not photography. Preserve upstream acknowledgements and consult each provider's terms before redistributing data or imagery; [LICENSE](../LICENSE) covers repository code, not a blanket relicensing of third-party products.

## Scientific interpretation

- Longitude is east-positive, latitude south-negative; no terrestrial WGS84/geoid conversion is applied.
- Analysis approval for the known source is restricted to **1962-01-01T00:00:00Z ≤ UTC < 2650-01-01T00:00:00Z**. Requests ending at/after the upper boundary are conservatively unreviewed. Exact-pole azimuth analysis remains unknown.
- Observer and ray heights use the same bilinear DEM interpolant. NoData is not replaced by zero; output precision does not add terrain resolution.
- Horizon rays follow lunar great circles. For reference radius `R`, observer radius `r0` and sampled terrain radius `rs`, obstruction elevation is `atan2(rs*cos(psi)-r0, rs*sin(psi))`, with `psi=surface_distance/R`.
- Production defaults are 20 km range, 1° azimuth spacing and 80 m radial steps; API observer offset is 0 m. Finite radial/angular sampling may miss ridges and does not certify the far field.
- Valid regional profiles can supply horizon points and `clearanceDeg`. **All real-source global `visible` values remain null**, global summaries stay null, and status is partial. `quality.terrainApplied=false` means no complete visibility solution, not necessarily no DEM sampling.
- Airless apparent center directions include astronomical apparent-position corrections. They do not model solar limb fractions, irradiance, power, thermal conditions, diffraction or radio link budgets.
- Rendered shadows, DEM cartographic gradients, globe context, Sun/Earth placement and stars are not numerical evidence of visibility. Optional cached local solar lighting does not alter the production regional-only/unknown-global visibility policy.

## Reproducibility

[Asset acquisition](science/ASSET_ACQUISITION.md) describes online and offline generation, validation and receipts. Generated files under `.validation/` and raw source data are ignored and need to be regenerated on a new checkout. Missing local receipts are not missing tracked documentation and must not be replaced by invented provenance.

[Coordinate conventions](COORDINATES_AND_TILES.md) define native sample centers and projected scene placement. Native patch proofs attest geometry-to-source consistency only; overview/spherical products are derived representations, not native-resolution coverage everywhere or independently measured truth.
