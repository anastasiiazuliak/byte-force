# Lunar Site Navigator

**Team Byte Force · NASA Space Apps Challenge Dnipro 2026**

**Lunar Site Navigator** is an interactive 3D web application and scientific analysis platform for evaluating and comparing candidate landing sites and UTC mission windows near the **Lunar South Pole** (`80°S–90°S`). By combining **NASA LOLA** digital elevation models with **NASA JPL Horizons** ephemerides and spherical lunar curvature modeling, it helps users visualize terrain shadows, Sun illumination, and Earth line-of-sight communication windows.

---

## The Problem

At the lunar South Pole, the Sun never rises more than ~1.5° above the horizontal plane. A **0.1° discrepancy** in elevation angle or terrain horizon can turn hours of predicted sunlight into deep crater shadow—or break direct-to-Earth radio communication. Standard 3D shadow maps or terrestrial coordinate systems (like WGS84) distort polar geometry and ignore lunar curvature, leading to inaccurate visibility estimates.

## Our Solution

Lunar Site Navigator bridges interactive 3D exploration with verifiable astrometric and topographic calculations:

- **3D Polar Terrain Explorer:** Interactive Three.js / React Three Fiber viewer featuring a full South Pole overview (`80°S–90°S`) and high-detail regional terrain patches (e.g., Connecting Ridge, Near Shackleton, Near de Gerlache) with real-time solar lighting and picking.
- **Analyze & Compare Modes:** Evaluate a single site or compare two candidate landing scenarios (**Site A** vs. **Site B**) across custom UTC time windows and step intervals.
- **360° Spherical Horizon & Line-of-Sight Engine:** Ray-marches the NASA LOLA DEM along all azimuths using the `1,737.4 km` lunar reference sphere (`MOON_ME` / South Polar Stereographic projection) to compute exact terrain obstruction angles.
- **Conditions Timeline & Export:** Interactive Chart.js timelines for Sun visibility, Earth visibility, and simultaneous windows, plus one-click **CSV** and **Print / PDF** report export.
- **Transparent Provenance:** Every response reports its exact ephemeris source, terrain dataset, resolution, and scientific warnings—never substituting synthetic values on failure.

---

## Architecture

| Layer | Directory | Tech Stack | Responsibility |
|---|---|---|---|
| **Frontend** | `frontend/` | React 19, TypeScript, Vite, Three.js / R3F, Chart.js | 3D terrain viewer, Analyze/Compare workspace, timeline charts, CSV/PDF export |
| **Backend API** | `backend/` | .NET 8, ASP.NET Core, `LunarNavigator.Core`, `LunarNavigator.Horizons` | 360° LOLA horizon ray-marching, JPL Horizons client, `/api/v1/{analyze,compare,ephemeris,map/metadata}` |
| **Data Pipeline** | `data-pipeline/` | Python, GDAL / NumPy / SciPy | LOLA DEM processing, GLB/WebP LOD tile pyramid, illumination masks, 5 m high-res pipeline |
| **Contracts** | `contracts/` | OpenAPI 3.0, JSON Schema, TypeScript | Shared API & 3D scene transform contracts |
| **Documentation** | `docs/` | Markdown | Scientific methodology, data provenance, coordinate transforms, validation report |

---

## NASA Data & Resources Used

1. **NASA LOLA DEM (`LDEM_80S_80MPP_ADJ.TIF`)** — Planetary Geodynamics Data Archive (PGDA, Goddard Space Flight Center, [Product 90](https://pgda.gsfc.nasa.gov/products/90)), 80 m/px South Polar Stereographic digital elevation model (`80°S–90°S`). Used for 3D terrain mesh generation and 360° horizon obstruction ray-marching.
2. **NASA JPL Horizons API (`coord@301`)** — Jet Propulsion Laboratory Solar System Dynamics ([Horizons](https://ssd.jpl.nasa.gov/horizons/)). Used for topocentric Sun and Earth azimuth/elevation ephemerides relative to lunar South Pole coordinates (DE421, `MOON_ME` reference frame).
3. **NASA LOLA Hillshade & LROC** — Reference surface textures and polar relief context.

> Detailed scientific documentation: [Data Sources](docs/DATA_SOURCES.md) · [Horizon Methodology](docs/SCIENCE_METHOD.md) · [Validation Report](docs/VALIDATION_REPORT.md) · [Coordinates & Tiles](docs/COORDINATES_AND_TILES.md)

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js 22+** and `npm`
- **.NET SDK 8.0**
- *(Optional)* Python 3.10+ for running `data-pipeline/` scripts

### 1. Run the Backend API
```sh
cd backend
dotnet restore LunarNavigator.sln
dotnet test LunarNavigator.sln --configuration Release
dotnet run --project LunarNavigator.Api --urls http://localhost:5080
```
Health check: `http://localhost:5080/api/v1/health`

### 2. Run the Frontend
```sh
cd frontend
npm install
npm run dev
```
Open the local Vite URL printed in the terminal (e.g., `http://localhost:5173`). Vite proxies `/api` requests to `http://localhost:5080`.

To run the frontend in standalone demo mode without the backend API, create `frontend/.env.local` with:
```dotenv
VITE_USE_MOCKS=true
```

### 3. Run Frontend Tests & Build
```sh
cd frontend
npm test
npm run test:contracts
npm run build
```

---

## AI Tools Disclosure

In accordance with NASA Space Apps Challenge 2026 guidelines, AI coding assistants were used during development for:
- Scaffolding boilerplate code, TypeScript/C# contract tests, and documentation structuring;
- Reviewing coordinate transform edge cases and accelerating UI component styling.

All scientific formulas, coordinate projections, NASA dataset integrations, and validation benchmarks were verified by the team using unit/integration tests and independent GDAL/Horizons checks.

---

## License

See [LICENSE](LICENSE) for details.
