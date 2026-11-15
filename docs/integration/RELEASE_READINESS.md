# PR15 · Release readiness

## Поточний статус і джерела правди

**PR15 OPEN**, та сама `.audit/final-integration` worktree. Root bootstrap не змінює цих інструкцій. Фінальний release SHA, push та GitHub CI confirmation очікуються від координатора; не переносити старий `955…`/FINAL report на цей стан. Остаточні commands/counts: [RELEASE_TEST_REPORT.md](RELEASE_TEST_REPORT.md), із завершеними локальними результатами та окремими pending gates. Цей документ не оголошує pending tests passed.

Review basis: [terrain science](../science/TERRAIN_SCIENCE_REVIEW.md), [asset acquisition](../science/ASSET_ACQUISITION.md), [3D](../3d/release-review.md), [UX](UX_REVIEW.md), актуальні `asset-setup.py`, `release_assets.py`, `run-local.py` та release evidence координатора. Старі review-local counts і candidate-only handoff описи слід читати в межах їхнього етапу; runtime promotion нині реалізований окремим proof-checked publisher.

## Baseline → зараз

| Область | Попередній PR15 baseline | Поточний стан |
|---|---|---|
| Runtime | .NET 8 | Усі 9 projects .NET 10, migration `27c414e`; stable SDK 10.0.113, actual API CoreCLR 10.0.13 |
| SDK/packages | Старий target | global 10.0.100/latestFeature/no prerelease; ASP.NET testing 10.0.15, Test SDK 18.12.0; Docker/CI 10, .NET 8 не потрібен |
| DEM/datum | 7 MB partial, unreviewed alignment | Full 189158392 bytes, exact-source datum gate схвалює reviewed radial definition у дозволену епоху |
| API terrain | Unknown terrain, partial | Actual regional horizon/clearance; **global visibility усе ще unknown/partial** |
| Picking | Disabled unreviewed preview | Proof-published 3 meshes, actual GLB triangle A/B picks/markers/patch switch |
| Світло | Fixed artistic | Cached Horizons topocentric local-light estimate; не global Moon-fixed, endpoint 503 |
| UI/tests | Приблизно 45 frontend / 162 backend | 74 frontend tests / 12 files після selective export port; backend 203 passed / 0 skipped; browser 13 passed до нових live export assertions |
| Performance | Main ~1225 KB / 345 KB gzip | Main ~254 KB / 80 KB gzip; lazy 3D 983 KB warning збережений |
| Deploy | Не перевірено | Config validated, daemon permission denied; build/runtime/external deploy досі не виконано |

## Ресурси

Усі paths відносні до final worktree. Ніякого manual download: `python3 scripts/asset-setup.py --capture-docs --acquire-nac --prepare-runtime --write-launch-env`. Повторний same-host offline build: `python3 scripts/asset-setup.py --offline --prepare-runtime --write-launch-env` із наявними повними даними.

| Ресурс / source URL | Bytes | Локальний path | Download / validation | Runtime usage |
|---|---:|---|---|---|
| [Official LOLA DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF) | 189158392 | `data/raw/LDEM_80S_80MPP_ADJ.TIF` | **Completed**; full length/SHA/geotags, Python усі 310 compressed tiles, C# 225 native tiles | Observer/ray bilinear surface, reviewed radial height, regional horizon/clearance |
| [Official LROC NAC I/F](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/M1188426614LE_20MPP.TIF) | 1411548 | `data/raw/M1188426614LE_20MPP.TIF` | **Completed**, geokeys/20 m registration/footprint/blocks verified; не MODEL image | Science source example; **не перекриває patches**, texture не застосована |
| Connecting Ridge; generated з [DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF), не окремий NASA GLB download | 884556 | `.validation/release-assets/connecting-ridge/terrain.glb` | Built; identity + native vertices/triangles/transforms proof | `/static/connecting-ridge/terrain.glb`, scoped picks/height mapping |
| Near Shackleton; generated з того самого [DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF) | 884516 | `.validation/release-assets/near-shackleton/terrain.glb` | Built; той самий per-artifact proof | `/static/near-shackleton/terrain.glb` |
| Near de Gerlache; generated з того самого [DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF) | 884556 | `.validation/release-assets/near-de-gerlache/terrain.glb` | Built; той самий per-artifact proof | `/static/near-de-gerlache/terrain.glb` |

DEM SHA-256: `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`. Це **local identity**, publisher checksum unavailable; ETag не заміняє publisher hash. Повні mesh identities/scene origins/proof — у science review. Усі великі raw/generated assets і receipts ignored, Git binary не додано.

Publication: `release_assets.py` звіряє source/mesh/native vertex proof, створює `.validation/runtime-assets/`, final metadata URLs та hidden `.release-review.json`, bound до exact files/mapping. Каталог `/static/metadata/explorer-sites.json`. Launcher перевіряє proof/roots перед map-review activation; flags із candidate manifests або довільний boolean не замінюють перевірку. Default public-assets без proof — unreviewed preview, `--fallback-assets` вибирає його явно.

## Що саме схвалено науково

- PGDA [product 90](https://pgda.gsfc.nasa.gov/products/90), [Barker/NTRS manuscript](https://ntrs.nasa.gov/citations/20230014419) і [PDS predecessor label](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/LDEM_80S_80M_FLOAT.LBL) встановлюють source family, MOON_ME/DE421 і radial height `r=1737400+h_m`; Horizons altitude `h_m/1000` km. Старі IMG kilometer units не застосовуються до нового TIF.
- Backend exact-body + native geotags + **same-open-handle identity** gate, **1962-01-01T00:00Z ≤ UTC < 2650-01-01T00:00Z**; немає arbitrary datum approval boolean. Інший/repacked файл потребує нового review. Immutable/read-only deployment; не модифікувати відкритий файл in place.
- Shared C# bilinear interpolation для observer і rays, PixelIsArea sample centers, NoData fail-closed, geodesic surface distances/curvature; production 360 points/1° azimuth, 80 m step, 20 km range.
- Три meshes: 15,876 vertices кожен, **47,628 total**, native coordinate/height agreement до **0.001 m numerical tolerance**. Це не physical accuracy, не незалежні ground-truth heights. Triangle vs bilinear subcell interpolation різні й не мають примусово збігатися.
- Actual API regional `horizon.points`, `horizonDeg`, `clearanceDeg` доступні для reviewed valid profiles. **Усі visible null, global summaries null, status partial, quality.terrainApplied=false**: finite-range sampling не доводить far-field completeness навіть за negative clearance. Немає global skyline/error bound, exact-pole azimuth review, limb/irradiance/power/thermal/radio-link science.

## Scene / UX / performance

Actual triangle picking і surface markers/focus для A/B; stale/in-flight/unverified mesh не pickable. Frontend довіряє launcher-published reviewed metadata, не видає себе за publisher authenticator. Локальний projection Jacobian переводить cached topocentric Sun az/el у scene; UTC scrub не генерує нових API requests, кадрова анімація не звертається до NASA. Це graphic estimate, `/api/v1/ephemeris` залишається 503, не global Moon-fixed synchronization.

Три exploratory patches, premium shell, cancel/retry і stale guard, keyboard/skip link/reduced motion; startup viewports 390×844, 768×1024, 1440×1000; intercepted post-analysis layout також 1024×768. Default 15 листопада, одногодинний UTC interval. **Quick compare** вже запускає реальне коротке порівняння (два samples/site), не лише готує форму; Prepare залишається окремою дією. Unknown не нулі. Main 254 KB/80 KB gzip; deferred 3D 983 KB warning залишається технічним обмеженням. LROC photos/textures не підроблені.

## Evidence: виконане та pending

| Перевірка | Підтверджений стан |
|---|---|
| Full opt-in .NET 10 backend | **203 passed, 0 failed, 0 skipped**; `.validation/final-backend-live.log`, включно real DEM/NASA; не 203 NASA calls |
| Frontend після selective export port | **74 tests / 12 files**; contracts **6** — subset, не додаткові tests |
| Backend HTTP/OpenAPI schema | **12 passed**, actual pipeline із synthetic science providers, не live NASA |
| Python | 13 acquisition + 4 runtime + 7 guard = **24 offline cases** |
| Combined browser | **13 passed** у `.validation/final-browser.log`: 6 intercepted, 2 live scientific NASA paths, 5 local startup/geometry/control cases; не 13 live science tests |
| Post-analysis UX | Intercepted synthetic responses, widths **390/768/1024/1440**; не live NASA layout evidence |
| Launcher smoke | **PASS**, `.validation/final-smoke.log`; HTTP/GLB/proof/startup/shutdown, не science test |
| Pending live export browser | 13-case log передує доданим CSV/print assertions; rerun currently testing, **не заявляємо passed** |
| Docker | Config validated only; daemon permission denied, no sudo, build/runtime не перевірено |
| GitHub/release | PR15 OPEN; final SHA/push/CI confirmation pending, не merged/deployed |

## Readiness checklist

- [x] Автоматичне acquisition/validation/build/publication без ручного download, без Git binaries.
- [x] Reviewed exact-source datum/mesh coordinate mapping та actual regional API.
- [x] Actual reviewed mesh interaction і локальне cached sunlight з чесними regional/Unknown labels.
- [x] [Точні запуск/cleanup інструкції](DEPLOYMENT.md), [pitch/demo/credits](DEMO.md).
- [x] Завершені backend 203/0, browser 13 та [RELEASE_TEST_REPORT](RELEASE_TEST_REPORT.md), з межами evidence.
- [ ] Нові live export browser assertions: completed rerun pending; фінальні SHA/push та GitHub CI confirmation pending.
- [ ] Docker image build/runtime smoke з дозволеним daemon access; external hosting тільки після окремого дозволу, TLS/storage/access review.
- [ ] Повна global skyline/visibility — **не закрито цим релізом**. Додаткова overlapping site texture unavailable.
- [ ] Людський licensing/credits/rules review, video/public URL verification і NASA submission/receipt.

Deadline: **15 листопада 23:55 Europe/Kyiv**; planning checkpoint, переданий координатором: **12:10**. Це не автоматично оновлюваний час. Пріоритет до дедлайну — final evidence, чесний regional walkthrough і human submission, не приховане розширення scientific claims.

П’ять внесків збережено: №1 3D, №2 UI (Khrystyna authored source), №3 Backend/Horizons, №4 LOLA/Data/HUM-02, №5 Integration/CI/QA. [README attribution/license](../../README.md#автори-джерела-й-ліцензії), [TEAM_ASSIGNMENTS](../../TEAM_ASSIGNMENTS.md). Code MIT не замінює review умов конкретних NASA/PDS/LROC assets. Жодних commits або submission дій цей documentation update не виконує.

## Selective UI/export audit

Новий UI range `a75d443..8394de2` має паралельний `MissionApp` / shared interfaces і **не merged wholesale**. Existing integrated shell/contracts retained. P2-02 export serializer/actions/tests/docs selectively ported зі збереженням teammate attribution (Khrystyna / UI source). CSV та print report доступні після Analyze/Compare; [format](../EXPORT_FORMAT.md). Frontend tests не підміняють pending live export browser rerun. Старі `FINAL_*` reports — historical snapshots; current evidence: [RELEASE_TEST_REPORT](RELEASE_TEST_REPORT.md).
