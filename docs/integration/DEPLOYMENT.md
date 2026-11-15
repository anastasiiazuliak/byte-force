# Поточний запуск і deployment · PR15

PR15 OPEN, той самий final checkout; [release readiness](RELEASE_READINESS.md) — поточний стан, [RELEASE_TEST_REPORT](RELEASE_TEST_REPORT.md) — фінальні результати координатора. Старі FINAL reports історичні.

Поточний default — **Globe View**; [spherical release / scientific method / final local evidence](SPHERICAL_RELEASE.md). Terrain View зберігає planar overview і три native patches. Поточні spherical зміни uncommitted; final backend rerun, push і CI pending coordinator, старі reports не підтверджують ці gates.

## Передумови й підготовка

Linux/WSL, Python 3.9+, Node.js 22/npm, **stable .NET SDK 10**. Усі 9 .NET projects мігровано (`27c414e`); `global.json` обирає stable 10.0.100 з `latestFeature`, фактично перевірено SDK 10.0.113 та API CoreCLR 10.0.13. .NET 8 не потрібен. Docker/CI target — 10.

З основного ByteForce root (не bootstrap runtime):

```sh
cd .audit/final-integration
npm ci --prefix frontend
dotnet restore backend/LunarNavigator.sln
python3 scripts/asset-setup.py --capture-docs --acquire-nac --prepare-runtime --write-launch-env
python3 scripts/run-local.py
```

Якщо вже у final worktree, не повторюйте `cd`. Package restore й automatic asset acquisition потребують мережі. Setup сам завантажує regional DEM/NAC, перевіряє та будує meshes: **manual download не потрібний**. Interrupted acquisition можна повторити; transport перевіряє ranges/validators/length і не склеює несумісні bytes. Повторне offline складання на тому самому host із повними наявними даними:

```sh
python3 scripts/asset-setup.py --offline --prepare-runtime --write-launch-env
```

`candidate-paths.env` — path handoff, не approval. `--prepare-runtime` викликає `release_assets.py`: exact identities + native proof, окремі deployment manifests, hidden `.release-review.json`, source/mesh/metadata binding. Candidate manifests самі не активують review. Release publisher генерує **обидва** source-bound assets: planar `/static/overview/terrain.glb` і spherical `/static/globe/terrain.glb`, metadata/catalog/proofs; offline preparation вище виконує той самий publisher, не лише native patches. Великі datasets, generated GLB і receipts ignored; Git binaries не додано. [Таблиця ресурсів](RELEASE_READINESS.md#ресурси).

## Один launcher, три сервіси

`python3 scripts/run-local.py` (або `sh scripts/dev.sh`) запускає:

| Сервіс | Адреса |
|---|---|
| Frontend | http://127.0.0.1:5173 |
| API health | http://127.0.0.1:5080/api/v1/health |
| Static assets | http://127.0.0.1:5081 |

Launcher перевіряє selected SDK 10, published proof і незайняті порти; чекає actual API health перед запуском/оголошенням Vite. Автоматично вибирає `.validation/runtime-assets`, звіряє hidden receipt та roots перед `MapManifest__MetadataReviewConfirmed=true`, бере reviewed DEM path. Root mismatch/invalid proof не можна обходити ручним review boolean. Backend datum approval окремо перевіряє exact opened DEM bytes/geotags/epoch: жодного datum env switch немає.

Reviewed URLs: `/static/{connecting-ridge,near-shackleton,near-de-gerlache}/terrain.glb`, каталог `/static/metadata/explorer-sites.json`. API metadata вказує повний known source і scoped reviewed coordinate/height mapping. Vite proxies `/api` до 5080, asset prefixes включно з `/static` — до 5081; API не є static host.

Без reviewed root використовується `public-assets`: unreviewed preview, picking disabled. Для навмисної перевірки fallback:

```sh
python3 scripts/run-local.py --fallback-assets
# bounded startup / HTTP / GLB readiness, потім cleanup:
python3 scripts/run-local.py --smoke --timeout 120
```

Static server обмежує prefixes/types, відхиляє traversal/symlink escape, приховані й неприйнятні paths, задає `nosniff`, GLB/WebP MIME та no-cache. Це не загальний файловий сервер. WebP MIME не означає site textures: NAC не перекриває patches.

`Ctrl+C`/SIGTERM завершує дочірні process groups; bounded smoke і Playwright cleanup перевірені. Не запускайте одночасно launcher і Playwright webServer на тих самих портах. Це стосується лише test-owned launcher. Для вже user-running 5080/5081/5173 Playwright reuse дозволений **тільки явним** `LUNAR_E2E_REUSE_SERVER=1`; reviewed/live cases додатково потребують `LUNAR_REVIEWED_E2E=1 LUNAR_RUN_LIVE_E2E=1`. Recorded spherical browser session reuse не доводить cleanup; user-owned сервери не зупиняти.

## Windows

**WSL рекомендовано**, бо launcher використовує POSIX `start_new_session`/`os.killpg`. Не діліть `node_modules` Windows/WSL.

Native Windows npm/dotnet підтримують звичайні команди. Після `npm ci --prefix frontend`, `dotnet restore backend/LunarNavigator.sln` і `python scripts/asset-setup.py --offline --prepare-runtime --write-launch-env` (лише якщо дані вже є; інакше automatic online setup вище) у трьох PowerShell/CMD вікнах із final root:

```text
dotnet run --no-launch-profile --project backend/LunarNavigator.Api --urls http://127.0.0.1:5080
```

```text
python -m http.server 5081 --bind 127.0.0.1 --directory public-assets
```

```text
npm run dev --prefix frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

Це **неперевірений native fallback preview**, не еквівалент proof-checked launcher: standard http.server не має його MIME/security/proof policy; default API map config не активує reviewed picking. Не виставляти цей static server назовні, не додавати `MetadataReviewConfirmed=true` вручну. Для reviewed трьох-patch workflow використовуйте WSL launcher. Кожен процес завершуйте `Ctrl+C`.

## Docker: конфігурація готова, runtime не перевірено

Docker daemon повертає permission denied; **sudo не використовувався**, images/build/runtime не перевірено. External deploy не дозволений/не виконаний. Після asset setup generated `.validation/runtime-assets/compose.env` задає asset/DEM paths. Людина з дозволеним daemon access може перевірити **локально**:

```sh
docker compose --env-file .validation/runtime-assets/compose.env config --quiet
docker compose --env-file .validation/runtime-assets/compose.env up --build -d
docker compose --env-file .validation/runtime-assets/compose.env ps
docker compose --env-file .validation/runtime-assets/compose.env logs --no-color
# http://localhost:8080
docker compose --env-file .validation/runtime-assets/compose.env down
```

.NET 10 API + nginx frontend/static, contracts COPY для build, read-only assets/DEM volumes. Web health через API не є scientific readiness. Після build потрібні actual API/GLB/catalog/metadata/analyze/compare smoke, static 404/MIME/security перевірки та зупинка. Config validation не доводить це виконаним.

Перед external hosting: окремий дозвіл, TLS/domain, access controls, persistent read-only source storage, monitoring/timeouts, перевірені cache/compression settings і external/mobile smoke. Секрети не в Git/images/`VITE_*`. Не називати локальний запуск public deployment.

## Update / rollback

Оператор спершу фіксує реальний release SHA/image digest, config та bound asset version. PR15 final SHA/CI ще очікуються. Upgrade — повторна proof verification, compose config/build/up і smoke; restart — `docker compose --env-file .validation/runtime-assets/compose.env restart`. Для rollback повертають погоджені попередні image/config/asset versions, перевіряють proof і виконують up/smoke. Наявну worktree не reset-ити. Runtime rollback тут не відрепетирувано.

## Science runtime contract

Повний 189158392-byte DEM уже доступний, старий 7 MB prefix/500 інцидент не є поточним data state. Exact body/geotags/same-open-handle identity і 1962 ≤ UTC < 2650 gate автоматично дозволяють reviewed radial alignment. Не можна схвалити інший файл boolean-ом. 20 km/1°/80 m regional model повертає horizon/clearance; `visible=null`, summaries null, partial і global `quality.terrainApplied=false` збережені. Мапа/picking approval не доводить глобальної видимості. [Science review](../science/TERRAIN_SCIENCE_REVIEW.md).
