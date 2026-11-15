# Lunar Navigator · ByteForce

Інтегрований Lunar Landing Site Navigator: за замовчуванням **Globe View** — source-derived сферичний south-polar cap 80–90°S із реального LOLA DEM, без exaggeration висот чи кривизни. **Terrain View** зберігає planar South Pole Overview і ручний перехід до трьох native 80 m дослідницьких patches; UTC-аналіз Сонця/Землі та A/B використовують NASA JPL Horizons. Це не повний Moon globe і не continuous tile streaming.

> **Поточний результат — regional estimate, не повна global visibility.** Реальні регіональні horizon/clearance доступні, picking і локальне освітлення працюють. Усі `visible` та глобальні summaries залишаються `null`, `status=partial`, `quality.terrainApplied=false`: рельєф за межами 20 km і похибка дискретизації не доведені. Це не рекомендація місця посадки, power prediction чи NASA-certified продукт.

## Актуальні документи

- **[Spherical release: scientific method, точні transforms, джерела, reproduction і фінальні локальні докази](docs/integration/SPHERICAL_RELEASE.md)** — поточний Globe default.
- [Polar overview](docs/integration/POLAR_OVERVIEW.md) — історичний planar stage, не поточний default; [selective UI integration audit](docs/integration/POLAR_UI_AUDIT.md).

- [Release readiness: стан PR15, ресурси, докази та gates](docs/integration/RELEASE_READINESS.md).
- [Запуск / deployment](docs/integration/DEPLOYMENT.md), [pitch і demo](docs/integration/DEMO.md).
- [RELEASE_TEST_REPORT](docs/integration/RELEASE_TEST_REPORT.md) — актуальні завершені результати й окремі pending gates; не доказ push/CI/deploy.
- [Terrain science review](docs/science/TERRAIN_SCIENCE_REVIEW.md), [acquisition](docs/science/ASSET_ACQUISITION.md), [3D review](docs/3d/release-review.md), [UX review](docs/integration/UX_REVIEW.md).
- [ТЗ](docs/TEAM_SPEC.md), [контракт](PARALLEL_CONTRACT.md), [OpenAPI](contracts/openapi.yaml), [scene transform](contracts/scene/TRANSFORM.md).

Старі FINAL/bootstrap reports описують попередні етапи, а не поточний release. **PR15 залишається OPEN**, у тій самій final worktree; merge, фінальний SHA і GitHub CI після push ще потребують підтвердження координатора.

## Швидкий старт: Linux / WSL

З кореня основного ByteForce checkout перейдіть саме в інтеграційну worktree (root bootstrap не змінено). Потрібні Python 3.9+, Node.js 22/npm та **stable .NET SDK 10**, не .NET 8:

```sh
cd .audit/final-integration
npm ci --prefix frontend
dotnet restore backend/LunarNavigator.sln
python3 scripts/asset-setup.py --capture-docs --acquire-nac --prepare-runtime --write-launch-env
python3 scripts/run-local.py
```

Якщо вже перебуваєте в final worktree, пропустіть `cd`. Asset setup автоматично завантажує/відновлює офіційні regional ресурси, валідує, генерує три native meshes, coarse planar overview і spherical cap як release publisher та публікує proof-bound runtime. **Ручного download не потрібно.** Потрібні мережа й місце на диску; великі assets ignored і не додаються до Git. Повторне складання з наявних даних без мережі:

```sh
python3 scripts/asset-setup.py --offline --prepare-runtime --write-launch-env
```

Одна команда `python3 scripts/run-local.py` запускає frontend **http://127.0.0.1:5173**, API **5080**, static **5081**. Launcher перевіряє .NET 10, published proof і API health до запуску Vite. `Ctrl+C` завершує дочірні процеси; cleanup перевірено. Bounded smoke: `python3 scripts/run-local.py --smoke --timeout 120`. Це історичний launcher-cleanup evidence, не стан поточної сесії: polar browser suite повторно використовує вже запущені користувачем API/static/frontend на **5080/5081/5173** через `LUNAR_E2E_REUSE_SERVER=1`. Ці сервери не зупинялися цим documentation task. Runtime validation перевіряє source-bound assets; попередні ~30 s стосувалися planar stage, не виміряного поточного spherical startup.

Без reviewed runtime launcher використовує unreviewed `public-assets` preview; `--fallback-assets` вибирає його навмисно, із disabled picking. Це не reviewed режим. Windows: рекомендовано WSL через POSIX process groups; [ручний native запуск](docs/integration/DEPLOYMENT.md#windows) описано окремо.

## Поточна архітектура

- `frontend/src/main.tsx` → `app/Application.tsx`: premium React/TypeScript shell, ScenarioForm, analysis/compare, UTC timeline і lazy R3F/Three.js explorer; один typed API client, cancel/stale-response guard.
- `.NET 10` API/Core/Models/Horizons: усі **9 проєктів**, migration `27c414e`. `global.json`: stable `10.0.100`, `latestFeature`; фактично SDK **10.0.113**, API CoreCLR **10.0.13**. ASP.NET testing **10.0.15**, Test SDK **18.12.0**; Docker/CI також 10.
- `data/raw/`: повний official LOLA і малий georeferenced LROC NAC; `.validation/release-assets/`: три generated candidates. `release_assets.py` перевіряє identity/native vertex proof і публікує `.validation/runtime-assets/` із hidden bound review receipt.
- API metadata та `/static/metadata/explorer-sites.json` використовують reviewed mapping. Globe default відкриває `/static/globe/terrain.glb`: **40,001 vertices / 79,304 triangles / 2,233,140 bytes**, R=1737400 m, r=R+h, scene `[MoonY,-MoonZ-R,-MoonX]`, origin South Pole, height/curvature 1×. Native sample centres обмежені перетином 80°S circle і raster coverage **±303960 m**. Terrain View зберігає `/static/overview/terrain.glb` (planar **79,600 triangles**); ручний вибір patches завантажує `/static/{site}/terrain.glb`. Окремий nonpickable DisplayPlinth — **800 vertices / 800 triangles**, «not lunar interior», не science bounds. Browser не завантажує TIFF; GPU-memory benchmark/FPS claim відсутні. Launcher дозволяє map review лише після перевірки proof; DEM datum має окремий exact-body/geotags/same-open-handle/epoch gate, не довільний boolean override.
- Observer і horizon rays використовують спільну bilinear DEM surface; геодезичні rays, сферична кривизна, 360 азимутів із кроком 1°, radial step 80 m, range 20 km.
- A/B markers і picking прив’язані до реальних GLB triangles та їх висоти. Exploration Lighting — нейтральне illustrative fill. Scientific Sun Lighting **disabled на Globe**: local direction не є global vector. Лише на reviewed Terrain cached topocentric Sun at **A** через local projection Jacobian може керувати приблизним графічним світлом при зміні UTC, без нового API запиту на кожен кадр. Це **не global Moon-fixed**: `/api/v1/ephemeris` лишається 503.

## Наукові межі

Повний DEM: **189158392 bytes**, local SHA-256 `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`. Python перевірив усі 310 compressed tiles, C# — 225 native tiles. PGDA + Barker/NTRS + PDS chain закриває radial-height definition: sphere **R=1737400 m**, **MOON_ME/DE421**. Автоматичне alignment approval лише для точних bytes/geotags і **1962-01-01 ≤ UTC < 2650-01-01**. Локальний SHA — identity, не publisher checksum.

47,628 vertices трьох meshes перевірені з числовим tolerance **1 mm**: це узгодженість координат/висот, **не фізична точність DEM**. Triangle-interpolated picked height може відрізнятися від backend bilinear height між vertices. Регіональні clearance — model estimates; ні позитивне, ні негативне значення не перетворюється на перевірений visibility boolean.

LROC NAC **завантажений**, геоприв’язка перевірена, але він **не перекриває** ці три patches. Реальних site textures/photos немає, нічого не підроблено. Graphic shadows не доводять фізичне освітлення, thermal/power або radio link budget.

## Перевірки й release статус

**Поточний spherical evidence** (наявні `.validation/globe-*` logs, не rerun цим docs task): frontend **107 passed / 16 files**, contracts **6** (subset), Playwright final **27 passed** із reviewed/live opt-ins; actual GLB/live NASA/DEM і intercepted synthetic/error/layout cases розділено в [детальному звіті](docs/integration/SPHERICAL_RELEASE.md#actual-final-local-test-evidence). Python **4 cap + 5 overview + 4 runtime + 13 acquisition + 7 guard = 33 passed**. Browser reuse user-running 5080/5081/5173 — явний opt-in, не доказ stopped servers. **Final .NET 10 backend rerun pending coordinator**; попередні **203 passed** не новий spherical rerun. Current spherical work uncommitted; final SHA/push/GitHub CI pending.

Нижче — попередній release-stage evidence, збережений як історичний snapshot, не новий polar rerun:

Full opt-in backend: **203 passed, 0 skipped** (`.validation/final-backend-live.log`), SDK **10.0.113** / runtime **10.0.13**, усі 9 projects `net10.0`. Frontend після selective export port: **74 tests / 12 files**, contracts **6** — subset; backend schema **12** — synthetic scientific providers, не live NASA. Python: **13 + 4 + 7 = 24 offline cases**. Browser: **13 passed** (`.validation/final-browser.log`): 6 intercepted cases, 2 live scientific NASA paths, 5 local startup/geometry/controls. Post-analysis widths **390/768/1024/1440** перевірено intercepted synthetic responses. Smoke **PASS** (`.validation/final-smoke.log`). Нові live export browser assertions ще testing і не входять до цього passed evidence. Final Git push/SHA та GitHub CI confirmation **pending** — [current test report](docs/integration/RELEASE_TEST_REPORT.md).

Після Analyze/Compare доступні **Download CSV** та **Print report / Save PDF**; [export format і Unknown/source labels](docs/EXPORT_FORMAT.md). CSV містить повну API sample series незалежно від timeline cursor. Наявність export/unit tests не означає завершеного live browser export rerun. Новий UI range `a75d443..8394de2` із паралельним `MissionApp`/shared interfaces не merged wholesale: existing shell retained; P2-02 serializer/actions/tests/docs selectively ported зі збереженням teammate attribution (Khrystyna).

Фактичний `.validation/globe-build.log`: main JS **271.79 kB / 85.80 kB gzip**, deferred explorer **987.63 kB / 271.27 kB gzip**, build **6.43 s**; >500 kB chunk warning збережений. GPU-memory/FPS benchmark відсутній; context-loss recovery фактично не тестували. Docker daemon permission denied: config validated, **не build/runtime/deploy**. Публічного deployment не виконано.

## Автори, джерела й ліцензії

Збережено внески всіх п’ятьох напрямів: **№1 3D**, **№2 UI**, **№3 Backend/Horizons**, **№4 LOLA/Data**, **№5 Integration/CI/QA** — [командні ролі](TEAM_ASSIGNMENTS.md), [people](people/). UI authored by **Khrystyna**, source `a75d443b7ea347443a7d1f1ec159fe1841c6132f`: вибірково збережений shell/design, не merge `demoSlots`. Попередня бібліотека [Horizons](docs/horizons.md) збережена, не приписана інтегратору. HUM-02 contribution `c960326`, merge `92de0e8` / PR #4 та [data README](data/README.md), scripts, [DATA_SOURCES](docs/DATA_SOURCES.md) збережені. CI source `892f4b8`: вручну відтворено трирядковий `fetch-depth: 0`; це не merge цілої гілки. [Архів provenance](docs/archive/package-reconciliation.md).

Код [MIT](LICENSE), © 2026 anastasiiazuliak. NASA/JPL Horizons, LRO/LOLA/PGDA, Barker et al. 2023 ([DOI](https://doi.org/10.3847/PSJ/acf3e1)), PDS і LROC атрибутуються окремо; [resource table](docs/integration/RELEASE_READINESS.md#ресурси). Команда перевіряє ліцензії конкретних assets, кредити всіх учасників, правила NASA Space Apps та submission. Hosting, credentials і подання — людські кроки, не автоматично виконаний реліз.
