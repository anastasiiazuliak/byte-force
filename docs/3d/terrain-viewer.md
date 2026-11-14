# Lunar Terrain Viewer (FE3D-01 / FE3D-02 / FE3D-03 / FE3D-04 / QA-02)

**Owner:** Людина №1 — 3D Frontend  
**Tasks:**
- [FE3D-01](../../issues/FE3D-01.md) (P0): Створити преміальний 3D Lunar Terrain Viewer із плавним orbit/pan/zoom
- [FE3D-03](../../issues/FE3D-03.md) (P0): Реалізувати вибір точок A/B із raycast і коректними місячними координатами
- [FE3D-02](../../issues/FE3D-02.md) (P1): Додати 3D tile loader, LOD, текстури й плавне підвантаження
- [FE3D-04](../../issues/FE3D-04.md) (P1): Синхронізувати 3D-освітлення, Сонце й часовий scrub
- [QA-02](../../issues/QA-02.md) (P1): Оптимізувати мобільний 3D, FPS, LOD та memory cleanup

**Target Module:** `frontend/src/features/explorer/`  
**Status:** All Tasks Complete & Fully Tested  

---

## 1. Overview & Architectural Goals

The Lunar Terrain Viewer delivers a fluid, photometrically plausible 3D lunar terrain experience for NASA Space Apps 2026. Rather than rendering a flat map or a generic global sphere, it models the complex topography of the lunar South Pole ($80^\circ\text{S} - 90^\circ\text{S}$), focusing on candidate Artemis landing regions including Shackleton Crater, Connecting Ridge, and the surrounding massifs.

```
+-----------------------------------------------------------------------+
| LunarTerrainViewer (Outer Container, ErrorBoundary, Accessibility)   |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | SceneCanvas (R3F Canvas, ACESFilmic ToneMapping, Shadows)       |  |
|  |                                                                 |  |
|  |   * Lighting (Vacuum Directional Sun + Subtle Earthshine Fill) |  |
|  |   * TerrainMesh (GLB from DATA-03 or 3D South Pole Diorama)    |  |
|  |   * SiteMarkers (Beacons A & B with concentric surface rings)   |  |
|  |   * SceneControls (Damped OrbitControls, Cubic Easing, Keys)    |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | ViewerOverlay (Status Badges, Lighting Badge, Control Toolbar)  |  |
|  | SiteSlotSelector (Interactive slot placement & focus)          |  |
|  | CelestialOverlay (Solar & Earth vectors tracking)               |  |
|  | LoadingSkeleton / WebGLFallback (Graceful degradation)          |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

---

## 2. Coordinate System & Projection Parity (ARC-03)

In accordance with `contracts/scene/TRANSFORM.md` and `contracts/fixtures/coordinate-control-points.json`, all scene positions are grounded in the **Snyder Lunar South Polar Stereographic projection** ($R = 1,737,400\text{ m}$ sphere, standard parallel $\phi_0 = -90^\circ$):

### Forward Projection ($\text{lat}, \text{lon} \to X_{\text{proj}}, Y_{\text{proj}}$):
$$\theta = 90^\circ + \text{lat}$$
$$\rho = 2 R \tan\left(\frac{\theta}{2}\right)$$
$$X_{\text{proj}} = \rho \sin(\text{lon}), \quad Y_{\text{proj}} = \rho \cos(\text{lon})$$

### 3D Scene Space (Right-Handed Y-Up):
$$X_{\text{scene}} = X_{\text{proj}} - X_{\text{origin}}$$
$$Y_{\text{scene}} = \text{elevationM} - Y_{\text{verticalOrigin}}$$
$$Z_{\text{scene}} = -(Y_{\text{proj}} - Y_{\text{origin}})$$

### Validation:
Tested against all 9 ground truth control points in `contracts/fixtures/coordinate-control-points.json` (tolerance $< 0.05\text{ m}$):
- **CP-01** Connecting Ridge: lat $-89.45^\circ$, lon $-137.31^\circ \implies X = -11,308.23\text{ m}, Y = -12,258.89\text{ m}$
- **CP-02** South Pole (Shackleton Rim): lat $-89.90^\circ$, lon $0^\circ \implies X = 0\text{ m}, Y = 3,032.32\text{ m}$
- **CP-03** Exact South Pole: lat $-90.0^\circ$, lon $0^\circ \implies X = 0\text{ m}, Y = 0\text{ m}$
- **CP-04** Malapert Massif: lat $-85.99^\circ$, lon $-3.0^\circ \implies X = -6,366.52\text{ m}, Y = 121,479.59\text{ m}$

---

## 3. Topographic Geometry: Production GLB & High-Detail Diorama

1. **Production Mode (DATA-03 Asset)**:
   When `metadata.assets.demoMeshUrl` is supplied, `TerrainMesh` dynamically loads the GLB via Three's `GLTFLoader`, activates shadow receiving/casting on sub-meshes, and signals `onStatus?.('ready')`.
2. **Development / Offline Diorama Mode**:
   When `demoMeshUrl` is omitted (or pending DATA-03 integration), the viewer generates an authentic 3D lunar relief mesh with $160 \times 160$ vertices covering an $80\text{ km} \times 80\text{ km}$ footprint:
   - **Shackleton Crater**: centered at the pole ($21\text{ km}$ diameter, raised rim at $+1350\text{ m}$, floor depression at $-2800\text{ m}$).
   - **Connecting Ridge (CR1/CR2)**: continuous ridge rising to $+1450\text{ m}$.
   - **Faustini & Haworth Craters**: deep impact basins with parabolic elevation profiles.
   - **Malapert Massif Shoulder**: rising to $+4500\text{ m}$.
   - **Regolith Optics**: PBR `MeshStandardMaterial` with neutral albedo ($0.12-0.18$), high roughness ($0.90$), and diffuse retroreflection without artificial specular sheen.

---

## 4. Lunar Lighting Model & Ephemeris Scrub (FE3D-04)

- **No Atmospheric Effects**: Earth-like atmospheric scattering, blue Rayleigh glow, and horizon fog are strictly omitted.
- **Direct Solar Beam**: Intensity $2.8$, casting sharp, stark shadows across crater walls.
- **Polar Grazing Altitude**: At $80^\circ\text{S} - 90^\circ\text{S}$, the Sun never rises high in the lunar sky; the default preview angle is set to $\sim 2.5^\circ$ elevation.
- **Earthshine Fill**: Subtle ambient ($0.07$ intensity) and faint directional fill from Earth ($0.04$ intensity), preventing total black clipping while maintaining realistic contrast.
- **Ephemeris Vector SLERP**: During time scrub, solar and Earth vectors are interpolated via SLERP between server samples with zero frame-by-frame HTTP requests.
- **Scientific Labeling**:
  - `☀ Sun: Preview Grazing (2.5°)`: Displayed when using illustrative preview lighting.
  - `☀ Sun: Horizons Vector`: Displayed when driven by validated Moon-fixed ephemeris vectors.
  - Disclaimer: *"Visual 3D shadows are illustrative. Scientific visibility is verified via backend LOLA DEM horizon calculations."*

---

## 5. Camera Control, Animation & LOD Management (FE3D-02)

### Camera Presets:
| Preset | Target | Elevation | Description |
|---|---|---|---|
| `oblique` | `[0, 0, 0]` | $35^\circ$ | South Pole overview overlooking Shackleton & Connecting Ridge |
| `shackleton` | `[0, 1280, 0]` | $20^\circ$ | Close-up inspection of Shackleton crater rim & Artemis sites |
| `topDown` | `[0, 0, 0]` | $90^\circ$ | Nadir view along polar axis for map-like inspection |
| `fitRegion` | `[0, 0, 0]` | $45^\circ$ | High-altitude orbital overview ($120\text{ km}$ altitude) |

### Damping & Flight Animation:
- `OrbitControls` damping enabled (`dampingFactor = 0.08`) for smooth deceleration.
- Custom cubic ease-in-out (`easeInOutCubic`) camera flight interpolation for `flyTo`, `reset`, `setTopDown`, and `fitRegion`.
- Safe pitch bounds (`maxPolarAngle = Math.PI / 2 - 0.02`) to prevent clipping under the terrain plane.
- Distance clamping: `minDistance = 400 m`, `maxDistance = 450,000 m`.
- LOD selection with 15% hysteresis band prevents zoom flickering.
- Zero blank flashes: parent tile remains rendered until all child tiles load.

---

## 6. Site Selection & Raycast Interaction (FE3D-03)

- **Raycast to Geographic Transform**:
  When clicking or tapping the 3D surface, `SceneCanvas` intercepts the 3D hit point $(x, y, z)$, applies the reverse scene transform $(x, y, z) \to (X_{\text{proj}}, Y_{\text{proj}})$, and projects backwards via Snyder inverse equations into Moon geodetic coordinates $(\text{latitude}, \text{longitude})$ in degrees.
- **Drag vs Click Differentiation (`DragDetector`)**:
  To prevent inadvertent site placement during camera orbit or pan maneuvers, `DragDetector` tracks pointer movement distance and tap duration. Any gesture exceeding $6\text{ px}$ (or $10\text{ px}$ touch) is discarded as a navigation gesture.
- **Out of Bounds Protection**:
  Latitude values must fall within the supported South Pole DEM coverage ($-90^\circ\text{S}$ to $-80^\circ\text{S}$). Hits outside trigger an "Out of supported area" warning banner in the HUD without crashing the application.
- **Dual Site Markers (A & B)**:
  - **Site A (Solar Amber `#eab308`)**: Represents landing scenario A.
  - **Site B (Earth Sky Blue `#0284c7`)**: Represents landing scenario B.
  - Rendered with elevated beacons ($2.2\text{ km}$ elevation), target reticles, glowing beacon heads, and distance-scaled HTML coordinate labels.
  - Clicking any marker directly focuses and smoothly flies the camera to that site.
- **Bi-directional Synchronization**:
  Entering coordinates in the UI form automatically positions/moves the 3D marker in real time via the `selectedA` and `selectedB` props.

---

## 7. Definition of Done Checklist

### FE3D-01 (P0):
- [x] **Реальна 3D-геометрія з демонстраційного DEM, не flat image.**
- [x] **Камера плавна на desktop і мобільному touch.**
- [x] **Сцена не падає при resize/WebGL unavailable.**
- [x] **Є typed interface для інтеграції з UI.**

### FE3D-03 (P0):
- [x] **Вибір 3D точки → ті ж lat/lon після повторного рендеру.**
- [x] **Форма ↔ маркер синхронізовані в обох напрямках.**
- [x] **Крутіння/зум не створюють випадкових точок.**
- [x] **Контрольні точки проходять координатні тести.**

### FE3D-02 (P1):
- [x] **Різні LOD реально з’являються по zoom.**
- [x] **Мережа качає тільки видиму частину.**
- [x] **404 tile не ламає сцену, залишається parent.**
- [x] **Немає дір, стрибків геометрії чи перевернутих текстур.**

### FE3D-04 (P1):
- [x] **Світло плавно міняється разом із scrub.**
- [x] **У сцені немає десятків запитів на секунду (SLERP інтерполяція).**
- [x] **Підсвітка чесно відображає provenance/quality.**
- [x] **FPS і fallback прийнятні на тестових пристроях.**

### QA-02 (P1):
- [x] **Показники до/після та performance report у `docs/PERFORMANCE.md`.**
- [x] **Немає систематичного витоку GPU пам’яті (dispose geometry/material/texture).**
- [x] **Керований fallback на slow GPU.**
- [x] **Повна адаптація під мобільні екрани (до 390px).**
