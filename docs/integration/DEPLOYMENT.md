# Локальний запуск і підготовка deployment

**Статус:** локальний bounded smoke пройшов після proxy fix; сервіси після тестів зупинено. Docker/compose/nginx конфігурацію перевірено, але daemon повернув permission denied: **images не побудовано, production не запущено, зовнішнього deployment не виконано й дозволу на нього немає**. [Повний стан](FINAL_INTEGRATION_REPORT.md), [остаточні тести](FINAL_TEST_REPORT.md).

## Linux / WSL: один launcher

Передумови: Python 3.9+, Node.js 22/npm, .NET SDK 8 відповідно до `global.json`. З кореня checkout:

```sh
npm ci --prefix frontend
dotnet restore backend/LunarNavigator.sln
python3 scripts/run-local.py
# або:
sh scripts/dev.sh
```

Адреси: frontend http://127.0.0.1:5173; API http://127.0.0.1:5080/api/v1/health; static http://127.0.0.1:5081. `Ctrl+C`/SIGTERM завершує process groups. Startup має deadline; звичайний interactive запуск працює до зупинки. Зайняті порти відхиляються, пакети/datasets автоматично не встановлюються/не завантажуються.

```sh
python3 scripts/run-local.py --smoke --timeout 120
# Лише для майбутнього повного, перевіреного DEM, не поточного truncated файла:
python3 scripts/run-local.py --dem data/raw/LDEM_80S_80MPP_ADJ.TIF
```

`--smoke` завершується сам: перевіряє frontend HTML, direct/proxied GLB MIME/signature й API metadata readiness (503 дозволений). Не перевіряє browser render, наявність WebP чи science. `--dem` лише задає шлях, **не підтверджує review/alignment**.

Vite proxy: `/api` → `API_PROXY_TARGET=http://127.0.0.1:5080`; `/terrain`, `/tiles`, `/metadata`, `/illumination` → `STATIC_PROXY_TARGET=http://127.0.0.1:5081`. API сам не віддає static files. Launcher static server задає `.glb` → `model/gltf-binary`, `.webp` → `image/webp`; реальних WebP assets поки немає.

Launcher задає absolute `MapManifest__ManifestPath` і `MapManifest__AssetRootPath` у `public-assets`; явні env values мають пріоритет. `--assets` змінює static root і default map paths. Без launcher relative API paths обчислюються від content root `backend/LunarNavigator.Api`, а не обов’язково кореня checkout.

`MetadataReviewConfirmed=false` лишайте false до незалежного review. Metadata 503 очікуваний; illustrative GLB все одно показується, geographic picking disabled, ручні координати працюють. Не вмикайте review flags для «зеленої» демо-перевірки.

## Windows

**Рекомендовано WSL** для повного launcher: `start_new_session`/`os.killpg` у Python сценарії — POSIX process-group implementation, не підтримка native Windows. Не діліть `node_modules` між Windows і WSL.

Нативний Windows: npm/dotnet працюють звичайними командами в окремих PowerShell/CMD вікнах. Усі наведені тут команди починаються з кореня checkout:

```text
npm ci --prefix frontend
dotnet restore backend/LunarNavigator.sln
```

Вікно 1 (API):

```text
dotnet run --no-launch-profile --project backend/LunarNavigator.Api --urls http://127.0.0.1:5080
```

Вікно 2 (static; Python має бути у PATH):

```text
python -m http.server 5081 --bind 127.0.0.1 --directory public-assets
```

Вікно 3 (frontend):

```text
npm run dev --prefix frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

Default Vite proxy уже спрямований на API/static вище. Для native static server перевірте GLB MIME: стандартний `http.server` залежить від Python MIME table і **не має гарантованих overrides launcher**. Для відтворення перевіреного MIME/smoke використовуйте WSL launcher. Без окремих absolute map env paths API лишиться у чесному metadata unavailable стані. Ці native Windows кроки — інструкції, не звіт про перевірку Windows runtime. Зупиніть кожне вікно `Ctrl+C`.

## Production: підготовлені nginx + .NET 8 контейнери

Наступні команди — для людини з Docker permissions; вони **не були успішно виконані як build/deploy тут**. Перший runtime запуск краще виконати локально, не виставляючи сервіс в інтернет.

```sh
docker compose config --quiet
docker compose up --build -d
# http://localhost:8080
docker compose ps
docker compose logs --no-color
docker compose down
```

`Dockerfile`: API publish stage та frontend build stage (включно з `contracts/` для TypeScript build). nginx віддає frontend, read-only `/assets` і proxy `/api/` до API:8080. SPA fallback лише для frontend routes; відсутній static asset → 404, не HTML. Web healthcheck проходить через `/api/v1/health`, але health не доводить scientific readiness. Proxy read timeout 130 s, API request timeout 120 s; Horizons HTTP timeout 30 s із bounded retry налаштовано у backend.

Опціональні overrides (POSIX shell, literal absolute paths замінює оператор):

```sh
ASSETS_DIR=/absolute/path/to/public-assets WEB_PORT=8088 docker compose up --build -d
DEM_DIR=/absolute/path/to/data/raw DEM_CONTAINER_PATH=/dem/LDEM_80S_80MPP_ADJ.TIF docker compose up --build -d
```

Assets/DEM не baked into images. Compose монтує assets і raw DEM read-only; API map paths абсолютні container paths, review false. Порожній/непридатний DEM не є deployment completion.

Підготовка OPS-02 ще **не повна production hardening**: потрібні HTTPS/domain, дозволи/credentials, storage capacity, compression, обґрунтований cache/versioning (не immutable для незмінно названих mutable assets), external/mobile smoke й monitoring. Не стверджуємо, що gzip/br або immutable caching уже реалізовані. Same-origin reverse proxy не потребує широкого CORS; backend default origins порожні, для окремих origins задавайте мінімальний allowlist. Секрети не зберігати в images/Git/`VITE_*`.

### Upgrade / restart / revert після дозволеного deployment

1. Зафіксувати попередній **реальний release SHA/image digest**, backup конфігурації та asset version; uncommitted checkout не є reproducible release.
2. На погодженому release виконати `docker compose config --quiet`, потім `docker compose up --build -d`. Перевірити logs, frontend, API health, GLB MIME, missing asset 404, real partial/analyze/compare та явні errors.
3. Restart без оновлення: `docker compose restart`. Це не замінює readiness перевірки.
4. Revert: оператор повертає раніше зафіксовані image/config/asset versions і виконує `docker compose up -d`; якщо працює source-build workflow — відновлює погоджений попередній release у deployment checkout і перебудовує. Не скидати поточну робочу інтеграцію. Конкретного production digest/rollback evidence наразі немає.

## DEM: фактичний outcome та майбутня перевірка

Дозволено було лише regional DEM (~180 MiB), не global/hillshade download. Official URL:
`https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF`.
HEAD: HTTP 200, **189158392 bytes**. Спроба:

```sh
python3 data/scripts/download_data.py --download --dem-only
python3 scripts/validate-data.py
```

Download досяг deadline **240 s**, залишив **7340032 bytes**. Validator відхилив incomplete файл; ignored `.validation/dem-receipt.json` містить розмір, локальний SHA256, tags/errors; download log — `.validation/dem-download.log`. Немає publisher reference checksum. Ні локальний hash, ні структурний parse не є незалежним науковим review. **Поточний файл не використовувати як DEM**, tracked mesh не перезаписано.

Пошкоджений DEM реально спричинив API 500 (invalid deflate/unread buffer). Root fix забезпечив HTTP 200 partial з двома реальними JPL samples у process check, а не terrain correctness. Фінальний Playwright Chromium/SwiftShader rerun **passed усі 4 tests за 20.6 s, exit 0**, включно з live test без mocks: local API → NASA analyze 200 partial із двома JPL samples і compare 200 для різних довгот A=25°E / B=26°E (A cached, B live), null terrain metrics. Screenshot: `.validation/real-nasa-analysis.png`; деталі — у test report. WebGL2/actual GLB MIME/signature, camera controls/negative picking та synthetic panels/timeline/compare/errors також перевірені. Окремий початковий timeout був teardown-дефектом: після трьох passed tests stdout дочірніх launcher processes лишався відкритим; Playwright `gracefulShutdown` із SIGTERM cleanup виправив завершення. Це не container/deployment або science validation.

Після майбутнього погодженого повного download повторіть validator; незалежно перевірте CRS, frame, vertical datum, coverage і контрольні висоти. **Поточний адаптер завжди повертає `DatumAlignmentVerified=false`, навіть за повного файла**. Це не configurable flag чи env switch: потрібен майбутній reviewed adapter, а не зміна уявного налаштування. Лише після успішних перевірок можна генерувати окремий patch, не замінюючи tracked mesh:

```sh
python3 data-pipeline/terrain_mesh/build_mesh.py \
  --source-file data/raw/LDEM_80S_80MPP_ADJ.TIF \
  --lat -89.45 --lon -137.31 --radius-km 0.5 \
  --output .validation/real-patch/terrain/0/0/0.glb \
  --manifest .validation/real-patch/metadata/terrain-manifest.json \
  --map-manifest .validation/real-patch/metadata/map-manifest.json
```

Це **не запускалося** на incomplete download. Не встановлюйте `MetadataReviewConfirmed=true` автоматично. LROC/WebP assets ще не підготовлені, tracked GLB provenance незалежно не reviewed, Moon-fixed provider unavailable, scene lighting artistic. Deployment readiness і scientific readiness — різні gates.
