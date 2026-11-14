# Lunar Terrain Horizon & Line-of-Sight Methodology (DATA-02)

**Project:** Lunar Landing Site Navigator — Byte Force (NASA Space Apps 2026)  
**Author:** Person #4 (LOLA / Data & Science Engineer)  
**Task ID:** DATA-02  
**Related Docs:** [COORDINATES_AND_TILES.md](COORDINATES_AND_TILES.md), [VALIDATION_REPORT.md](VALIDATION_REPORT.md)  

---

## 1. Purpose

To determine whether the Sun or Earth is visible from a candidate lunar South Pole landing site at a given UTC instant, the backend compares the body's topocentric elevation angle (from JPL Horizons `coord@301`) against the **local terrain horizon elevation angle** $\theta_{\text{horizon}}(\alpha)$ across all azimuths $\alpha \in [0^\circ, 360^\circ)$.

---

## 2. Polar Azimuth Convention (`ARC-03` & JPL Horizons Alignment)

In South Polar Stereographic coordinates $(X, Y)$ with origin at the South Pole $(-90^\circ, 0^\circ)$:
- $+Y$ points along the Prime Meridian ($0^\circ$ longitude).
- $+X$ points along $+90^\circ\text{E}$ longitude.

For an observer at projected coordinates $(X_0, Y_0)$ with polar radius $\rho_0 = \sqrt{X_0^2 + Y_0^2}$:
1. **Standard Polar Site ($\rho_0 > 10^{-6}\text{ m}$):**
   - **Local North ($\alpha = 0^\circ$):** radially outward from the South Pole toward the equator:
     $$\hat{u}_N = \left(\frac{X_0}{\rho_0},\ \frac{Y_0}{\rho_0}\right)$$
   - **Local East ($\alpha = 90^\circ$):** $90^\circ$ clockwise in the stereographic map (increasing eastern longitude):
     $$\hat{u}_E = \left(\frac{Y_0}{\rho_0},\ \frac{-X_0}{\rho_0}\right)$$
2. **Exact South Pole Singularity ($\rho_0 \le 10^{-6}\text{ m}$, latitude $-90^\circ$):**
   - Per `ARC-03` contract, $\alpha = 0^\circ$ aligns with the $0^\circ$ Prime Meridian:
     $$\hat{u}_N = (0, 1), \quad \hat{u}_E = (1, 0)$$
   - Avoids division by $\cos(\text{lat}) = 0$.

For any azimuth $\alpha$:
$$\hat{d}(\alpha) = \cos(\alpha)\,\hat{u}_N + \sin(\alpha)\,\hat{u}_E$$

---

## 3. Ray-Marching & Spherical Lunar Curvature

Along each azimuth ray $\alpha$, the algorithm samples elevations $H(s)$ at distances $s = \Delta s, 2\Delta s, \dots, s_{\max}$ using bilinear interpolation over the extracted LOLA DEM window (`ITerrainService.GetWindowAsync`).

Accounting for the lunar reference sphere of radius $R = 1,737,400.0\text{ m}$:
- Observer radius from Moon center: $r_0 = R + H_{\text{DEM}}(0) + h_{\text{offset}}$ (where default $h_{\text{offset}} = 2.0\text{ m}$).
- Terrain sample radius from Moon center: $r_s = R + H_{\text{DEM}}(s)$.
- Central arc angle: $\psi = \dfrac{s}{R}$.

The exact spherical elevation angle $\theta(s)$ from the observer's local horizontal plane to the terrain point is:
$$\theta(\alpha, s) = \operatorname{atan2}\left(r_s \cos\psi - r_0,\ r_s \sin\psi\right)$$

The horizon angle at azimuth $\alpha$ is the maximum obstruction angle along the ray:
$$\theta_{\text{horizon}}(\alpha) = \max_{s \in [\Delta s,\ s_{\max}]} \theta(\alpha, s)$$

### Why Spherical Curvature Matters
At a distance of $s = 20\text{ km}$, lunar curvature drops the horizon by:
$$\Delta h_{\text{curv}} \approx \frac{s^2}{2R} = \frac{20,000^2}{2 \times 1,737,400} \approx 115.1\text{ m} \quad (\approx 0.33^\circ)$$
At the lunar South Pole where solar elevation rarely exceeds $1.5^\circ$, omitting curvature creates a systematic bias of $\sim 0.33^\circ$, which corresponds to hours of erroneous sunlight prediction.

---

## 4. Azimuthal Interpolation & Quality Guarantees

- **Cyclic Wrap-Around:** `GetElevationAtAzimuth(profile, azimuthDeg)` normalizes $\alpha \in [0^\circ, 360^\circ)$ and linearly interpolates between adjacent rays, seamlessly wrapping across $359^\circ \leftrightarrow 0^\circ$.
- **NoData Handling:**
  - If the observer's center location is `NaN` (NoData) or outside DEM coverage, `TerrainApplied = false` and an empty profile with a warning is returned.
  - Individual `NaN` samples along a ray are skipped and logged in `Warnings` rather than coerced to $0\text{ m}$.
- **Compute Budget & Cancellation:**
  - Supports `CancellationToken` on every ray.
  - Respects `MaxComputeMilliseconds`, returning a `TerrainApplied = false` partial result with a clear warning if exceeded.
- **Caching:**
  - Profiles are cached in-memory by `(datasetKey, lat, lon, azStep, maxRange, rayStep, observerOffset)` with bounded FIFO eviction.

---

## 5. Scientific Illumination Raster Masks (P2-01)

Visual Three.js directional shadow maps depend on GPU shadow bias, frustum size, and camera distance, and **do not account for lunar spherical curvature**. For scientific illumination overlays, `data-pipeline/illumination/build_illumination.py` precomputes physically accurate visibility masks:

- **Method:** For each pixel $(x, y)$ in the LOLA DEM tile, a ray is marched along the Sun's JPL Horizons azimuth $(\alpha_\odot)$ up to `maxRayRangeMeters` (default $5\text{–}20\text{ km}$) with spherical curvature ($R = 1,737,400\text{ m}$), matching `LolaHorizonService`.
- **Outputs:** RGBA WebP masks at `/illumination/{timeKey}/{z}/{x}/{y}.webp` and `public-assets/illumination/illumination-manifest.json`.
  - Lit pixel: warm translucent highlight (`#FFE680`, $\alpha \approx 0.31$).
  - Shadowed pixel: deep blue-black scientific shadow (`#080C18`, $\alpha \approx 0.71$).
  - NoData pixel: fully transparent (`alpha = 0`).
- **Performance & Cost:** On a $64 \times 64$ tile at $80\text{ m}$ ray step, offline generation takes **~170–220 ms per timestamp** in pure Python stdlib.
- **Frontend Integration Proposal:** Overlay as an optional toggleable layer with an opacity slider, display the UTC timestamp and quality warning (`80 m/px DEM, point-source Sun`), and hide gracefully on HTTP 404 when no mask is precomputed for a tile.
