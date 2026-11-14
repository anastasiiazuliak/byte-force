# API — backend lane 3

.NET 8; усі проєкти — в `backend/LunarNavigator.sln`, тести — в `backend/tests/LunarNavigator.Api.Tests`.
HTTP base `/api/v1`, JSON camelCase, UTC ISO-8601 з `Z`. Health/config/catalog працюють offline;
analyze/compare потребують NASA Horizons. Без перевіреного terrain повертаються чесні partial/null,
а не синтетичні наукові результати.

| Задача | Endpoint | Поточна поведінка |
|---|---|---|
| BE-01 | GET `/health` | Liveness HTTP-сервера та версія; не перевіряє NASA/DEM |
| BE-01 | GET `/config` | Реальні ліміти й feature flags; comparison=true, terrain/horizon=false, Moon-fixed=false за замовчуванням |
| BE-01 | GET `/landing-sites` | Локальний валідований каталог; bundled точки явно DEMO |
| BE-02 / BE-03 | POST `/analyze` | Реальні Sun/Earth az/el через існуючий Horizons client; без перевіреного terrain — partial/null |
| BE-06 | GET `/map/metadata` | Читає й перевіряє manifest та assets; без них 503 TERRAIN_DATA_UNAVAILABLE |
| BE-04 | POST `/compare` | Повні аналізи A/B, стабільний порядок A потім B, різниця B−A; unknown залишається null |
| BE-05 | POST `/ephemeris` | Тільки перевірений IMoonFixedProvider; до інтеграції — 503 EPHEMERIS_UNAVAILABLE |

## Запуск і перевірка

З кореня репозиторію:

```sh
dotnet restore backend/LunarNavigator.sln
dotnet build backend/LunarNavigator.sln
dotnet test backend/LunarNavigator.sln
dotnet run --project backend/LunarNavigator.Api --urls http://localhost:5080
```

Для Windows PowerShell використовуйте `curl.exe` замість `curl`:

```sh
curl -i http://localhost:5080/api/v1/health
curl -i http://localhost:5080/api/v1/config
curl -i http://localhost:5080/api/v1/landing-sites
curl -i http://localhost:5080/api/v1/map/metadata
curl -i -H "Content-Type: application/json" --data-binary @analyze-request.json http://localhost:5080/api/v1/analyze
curl -i -H "Content-Type: application/json" --data-binary @compare-request.json http://localhost:5080/api/v1/compare
curl -i -H "Content-Type: application/json" --data-binary @ephemeris-request.json http://localhost:5080/api/v1/ephemeris
```

`analyze-request.json`:

```json
{
  "location": { "latitude": -89, "longitude": 25 },
  "period": { "startUtc": "2026-11-14T00:00:00Z", "endUtc": "2026-11-14T01:00:00Z", "stepMinutes": 60 },
  "options": { "terrainModel": "lola", "includeHorizon": true }
}
```

`compare-request.json`:

```json
{
  "scenarios": [
    {
      "id": "A", "location": { "latitude": -89, "longitude": 25 },
      "period": { "startUtc": "2026-11-14T00:00:00Z", "endUtc": "2026-11-14T01:00:00Z", "stepMinutes": 60 }
    },
    {
      "id": "B", "location": { "latitude": -88, "longitude": 26 },
      "period": { "startUtc": "2026-11-14T00:00:00Z", "endUtc": "2026-11-14T01:00:00Z", "stepMinutes": 60 }
    }
  ]
}
```

`ephemeris-request.json`:

```json
{ "startUtc": "2026-11-14T00:00:00Z", "endUtc": "2026-11-14T01:00:00Z", "stepMinutes": 60 }
```

Analyze/compare потребують мережі до NASA; health/config/catalog працюють офлайн.
Map і Moon-fixed endpoints без зовнішньої інтеграції повертають контрактну помилку, без підставних даних.

## Sampling, terrain і visibility

- Валідація: finite lunar coordinates, UTC Z (без локальних offset), increasing period, milliseconds or coarser,
  configured min/max step, maxSamples. Період включає start, проміжні steps і terminal end sample; останній крок
  може бути коротшим. Ліміт samples враховує terminal sample. Інтервали та години описують `[start,end)`.
- Незмінений `LunarNavigator.Horizons` повертає airless apparent azimuth/elevation центрів тіл. Азимут нормалізується
  до `[0,360)`; north=0, east=90. На точному полюсі меридіанна конвенція потребує review, тому terrain visibility там partial.
- `IObserverAltitudeResolver` дозволяє meters→km тільки для явно вирівняного датуму
  `HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M` і `DatumAlignmentVerified=true`.
  Інший датум потребує окремого перевіреного adapter. Без нього використовується геометричний observer на reference sphere
  height=0km із warning; це не DEM-висота, не перевірена рельєфна видимість.
- Для terrain visibility потрібні matching source/resolution height+horizon, valid 360° cyclic profile з максимальним
  angular gap 5°, finite elevations, verified datum. Профіль циклічно інтерполюється; clearance=elevation−horizon,
  visible=true тільки при clearance>0. includeHorizon=false приховує payload профілю, не вимикає обчислення.
- Crossing time лінійно інтерполюється між clearance samples; summary hours обчислюються з тих самих intervals,
  bothVisibleHours — з перетину Sun/Earth intervals. Це sampling-based оцінка, не точний event solver.
- Без valid terrain: status=partial, visible/horizonDeg/clearanceDeg/summary metrics=null, intervals порожні,
  quality.terrainApplied=false. Невідоме не перетворюється на 0 або false.
- Потенційне освітлення не дорівнює електричній потужності; Earth visibility не гарантує радіозв'язок.
- Compare перевіряє обидва сценарії до запитів NASA, має independent linked cancellation, reuse identical analyses
  лише в межах одного compare. При failure повертається одна структурована помилка, не вигаданий другий сценарій.
  Різні тривалості позначаються warning; periods і percentages дозволяють правильно трактувати абсолютні години B−A.

## Налаштування

`appsettings.json` + environment overrides (`Api__MaxSamples`, `Api__AllowedOrigins__0`, тощо).
CORS — лише exact configured origins, GET/POST, без credentials; defaults empty.
MaxScenarios завжди 2 за frozen contract. Невалідні settings зупиняють startup.
`Api__RequestTimeoutSeconds` (default 120) дає 504 ANALYSIS_TIMEOUT; caller cancellation зберігається.

`Ephemeris__HttpTimeoutSeconds` default 30, `MaxAttempts` 2 (maximum 3), `RetryDelayMilliseconds` 250,
`CacheSeconds` 3600. Retry лише для network/408/429/5xx/HTTP timeout, без retry malformed result або 4xx.
Point cache bounded to 10,000, key=exact coordinates + reference-sphere altitude + UTC instant; failures не кешуються.
Запити послідовні, як вимагає NASA. Великий cold period може досягти deadline; зменште period/збільште step.
Horizon profiles кешуються на 60s, максимум 128 keys (location/height/source/datum/resolution), whole analysis не кешується.
Оскільки frozen provider interface не має revision token, deployment data change потребує invalidation/restart;
proposal наведено в docs/contract-change-request.md.

`Api__CatalogPath`: JSON, absolute або relative to API content root. Валідні finite bounds, id/name/description;
дублікати ID відкидаються всі. Реальні записи потребують HTTPS sourceUrl без credentials та людської перевірки
походження; unsourced тільки explicit DEMO labels. Missing/malformed catalog — 503 INTERNAL_ERROR.

`Terrain__DemPath` optionally connects the existing DATA-01 GeoTIFF reader (absolute or API-content-root relative path).
Without an explicit path, TerrainFactory checks LUNAR_DEM_PATH / LUNAR_DATA_DIR and the local data/raw default; missing or corrupt input is unavailable. The API adapter exposes available heights while
sanitizing internal path/error warnings and forcing DatumAlignmentVerified=false: current DATA-01 default metadata
is not independent proof of frame/datum alignment. A scientifically reviewed provider/adapter must replace this gate
before terrain visibility can become complete. Final integration wires LolaHorizonService and hardens truncated/corrupt TIFF handling; incomplete profiles never claim verified terrain.

## BE-06: manifest handoff

`MapManifest__ManifestPath`: JSON envelope `{schemaVersion:1, metadata:<frozen MapMetadataResponse>, requiredAssets:[...]}`.
Це локальна data-lane handoff proposal, не зміна HTTP response schema. Готовий production manifest не додавався.
`MapManifest__AssetRootPath`: local deployment root для перевірки існування файлів.
`MapManifest__MetadataReviewConfirmed` default false: contributor verified flags require independent review confirmation, in addition to all structural/asset checks; do not enable it merely to suppress 503.
`MapManifest__AssetBaseUrl`: optional HTTPS CDN base; без нього URLs тільки relative/same-origin.

Verified metadata потребує exact Moon south-polar stereographic PROJ definition (`+proj=stere`, `+lat_0=-90`,
`+R` або `+a`/`+b` для lunar sphere, `+units=m`), MOON_ME, known vertical reference, valid bounds,
validated scene transform і доступного GLB. Templates require matching files in requiredAssets; extensions GLB/WebP,
traversal/foreign origins/placeholders заборонені. MetadataVerified/transform validated не виставляються backend-ом
автоматично. Unverified metadata може мати null CRS/bounds/transform і лише наявний demo GLB; scientific templates
не дозволені. Missing/invalid manifest/version/assets — 503 TERRAIN_DATA_UNAVAILABLE.
Статичні файли віддає deployment static server/CDN; controller їх не створює та не роздає.

## BE-05: Moon-fixed handoff

`IMoonFixedProvider` має дати незалежно перевірені MOON_ME directions із synchronised timestamps, source і convention.
Default adapter unavailable. Service перевіряє frame verification, count/order/time і finite nonzero 3-vectors;
нормалізує їх до unit vectors зі збереженням осей. Немає перетворення локальних ENU angles у глобальні vectors.
`moonFixedEphemeris` залишається false, доки verified provider не підключений. Rotation в projected scene
потребує окремої перевірки DATA/FE3D; нормалізація сама по собі не доводить правильність frame.

## Тести й handoff

Детальний стан всіх шести задач, фактично виконані перевірки та джерела — у [docs/LANE-3-HANDOFF.md](docs/LANE-3-HANDOFF.md).
Повторювана перевірка JSON Schema — у [Contracts README](../tests/LunarNavigator.Api.Tests/Contracts/README.md).
Контракти, frontend, Terrain/Horizon implementation і data pipeline не змінювалися. Commit/push/merge/deploy не виконувалися.
