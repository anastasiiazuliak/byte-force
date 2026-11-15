# Lunar Navigator · ByteForce

Україномовний інтегрований прототип **Lunar Landing Site Navigator**: місце біля південного полюса Місяця + UTC-період → аналіз Сонця/Землі → порівняння сценаріїв A/B. Мета NASA Space Apps — допомогти оцінювати освітлення й можливість зв’язку, а не лише показувати красиву поверхню.

> **Це вже інтегрований застосунок, але не науково валідований планувальник місій.** Реальний API підключений до JPL Horizons; за відсутності придатного DEM він повертає partial, а не вигадану terrain visibility. Наявна 3D-геометрія й художнє світло не доводять реальне освітлення місцевості. Публічний deployment не виконано.

## Почати тут

- [Фінальний інтеграційний звіт і чесний DoD](docs/integration/FINAL_INTEGRATION_REPORT.md).
- [Демо / HUM-04: pitch, реальний partial і окреме synthetic demo](docs/integration/DEMO.md).
- [Запуск, Windows, Docker та дані](docs/integration/DEPLOYMENT.md).
- [Фінальний звіт тестування](docs/integration/FINAL_TEST_REPORT.md) — джерело актуальних фінальних лічильників; його завершує координатор інтеграції.
- [Аудит гілок](docs/integration/FINAL_BRANCH_AUDIT.md), [ТЗ](docs/TEAM_SPEC.md), [заморожений контракт](PARALLEL_CONTRACT.md), [OpenAPI](contracts/openapi.yaml), [API DTO](contracts/api-types.ts), [scene transform](contracts/scene/TRANSFORM.md).

## Архітектура поточної інтеграції

```text
React Application → typed LunarApiClient → /api/v1 → ASP.NET Core → JPL Horizons
       │                                           └→ Terrain/Horizon services
       └→ R3F/Three.js → /terrain, /tiles, /metadata, /illumination → static assets
```

- `frontend/src/main.tsx` → `app/Application.tsx`: справжній composition root. `AppShell` отримує інтегровані slots форми, analysis, compare, timeline та `LunarTerrainViewer`; старий автономний explorer не є головним застосунком.
- `frontend/src/integration/client.ts` і `src/api/`: один typed client, незалежне startup-завантаження health/config/sites/metadata, явні error/partial стани. Зміна введення скасовує pending запит; identity guard не публікує застарілу відповідь. Analyze запускається явно; timeline використовує отримані samples.
- `backend/LunarNavigator.sln`: активне .NET 10 solution; API, Core, Models, збережена бібліотека Horizons, тести й live sample. API підключає реальний `HorizonsEphemerisService`, terrain/horizon providers і compare. Moon-fixed provider поки unavailable (503).
- `public-assets/`: окремий static root, не ASP.NET static middleware. Vite proxy об’єднує його з API локально; nginx — у підготовленій контейнерній конфігурації.
- `data-pipeline/`: підготовка геометрії/metadata; `data/` зберігає попередні acquisition scripts. Сирі дані та `.validation/` не є релізними артефактами.

## Локальний запуск Linux / WSL

Потрібні Git, **Node.js 22**, npm, **.NET SDK 10** (див. `global.json`), Python 3.9+. Усі команди нижче — з кореня цього checkout; установлення пакетів може звертатися до npm/NuGet. NASA download не є частиною запуску.

```sh
npm ci --prefix frontend
dotnet restore backend/LunarNavigator.sln
python3 scripts/run-local.py
# еквівалент: sh scripts/dev.sh
```

Відкрийте **http://127.0.0.1:5173**. API: `http://127.0.0.1:5080/api/v1/health`; static: `http://127.0.0.1:5081`. `Ctrl+C` завершує дочірні процеси. Зайняті порти відхиляються. Сервери після інтеграційних тестів зупинені: запускайте їх самостійно.

Обмежений smoke із автоматичним завершенням:

```sh
python3 scripts/run-local.py --smoke --timeout 120
```

Він перевіряє HTTP readiness, HTML, прямий та proxied GLB MIME/signature. Це **не** browser або science validation; metadata 503 допускається як чесний стан неготовності. На Windows рекомендовано **WSL**: Python launcher використовує POSIX process groups. Нативні npm/dotnet і окремий static server можна запускати вручну — [точні інструкції](docs/integration/DEPLOYMENT.md#windows).

## Реальний режим та явне демо

За замовчуванням `frontend/.env.example` задає `VITE_USE_MOCKS=false` і `/api/v1`. Не підміняйте помилку API моками. Введіть координати вручну (наприклад, `−89.45`, `−137.31`), UTC-інтервал і натисніть Analyze. Для короткого live smoke почніть з `2026-11-14T00:00` — `2026-11-14T01:00`, крок `60`; фактична реалізація повертає два samples, включно з обома кінцями. Visibility intervals окремо мають семантику `[startUtc,endUtc)`. Реальні запити звертаються до зовнішнього NASA JPL, потребують мережі, не потребують API key та можуть бути повільними/недоступними.

Для **окремої демонстрації UI**, додайте `VITE_USE_MOCKS=true` у `frontend/.env.local` і перезапустіть Vite. DEV-only transport показує **SYNTHETIC / DEMO**: графіки, horizon, summaries і compare тут не NASA-вимірювання. Production build не активує ці моки. Не кладіть секрети у `VITE_*`.

## Що реально відомо

- Після виправлення читання пошкодженого/truncated DEM реальний процес API повернув **200 partial з двома JPL samples**. Початковий invalid-deflate/unread-buffer шлях давав 500; це не був лише теоретичний дефект.
- Чинний tracked `public-assets/terrain/0/0/0.glb` (~884 kB) показаний у Chromium WebGL, але provenance геометрії та metadata **не перевірено незалежно**. `MetadataReviewConfirmed=false` → map metadata 503 → geographic picking вимкнений; ручні координати доступні.
- Офіційний LOLA download (HEAD: 189158392 bytes) перервано deadline 240 s після 7340032 bytes. `scripts/validate-data.py` позначив файл incomplete; ignored receipt не є scientific evidence. **Не використовуйте його як DEM.**
- Навіть повний download не зніме консервативний gate: поточний адаптер завжди повертає `DatumAlignmentVerified=false` (це не configurable setting або env switch; потрібен майбутній reviewed adapter); узгодження CRS/frame/vertical datum залишається невирішеним. Наукова terrain visibility не підтверджена.
- Реальні LROC/WebP текстури не підготовлено; MIME налаштовано, але assets відсутні. Raw vectors не застосовуються до сцени; Moon-fixed endpoint 503, світло художнє й фіксоване, без перевіреної Sun/Earth 3D-синхронізації.
- `visible:null` означає невідомо, не «не видно»; невідомі summaries не нулі. Compare — **B − A**. Графічні тіні не замінюють рельєфного горизонту.

## Перевірки

```sh
npm run build --prefix frontend
npm test --prefix frontend
npm run test:contracts --prefix frontend
dotnet test backend/LunarNavigator.sln --configuration Release
npm run test:e2e --prefix frontend
```

Playwright має власний bounded launcher; не запускайте паралельний сервер на тих самих портах. Chromium/browser dependencies потрібно встановити окремо. Offline backend: **162 passed, 1 live skipped**; окремий opt-in live Horizons test — **1 passed**. Фінальний Playwright Chromium/SwiftShader rerun: **4 passed за 20.6 s, exit 0**. Перевірено WebGL2 canvas, actual GLB MIME/`glTF` signature, camera buttons і negative picking; на synthetic fixtures — graphs, Play/Pause, scrub, compare та errors. Четвертий тест **без mocks** пройшов browser → local API → NASA: analyze **200 partial, два JPL samples**, compare **200** для різних довгот A=25°E / B=26°E (A cached, B live), terrain metrics — `null`. Screenshot: `.validation/real-nasa-analysis.png`.

Початковий live 500 усунено backend truncated-DEM fix. Окремий початковий E2E timeout був teardown-дефектом: три tests уже пройшли, але stdout дочірніх launcher processes лишався відкритим; Playwright `gracefulShutdown` із SIGTERM cleanup виправив завершення. Це не підтверджує реальний DEM або terrain visibility.

**12 response payloads із реального ASP.NET pipeline з offline synthetic science providers пройшли AJV**. Security guard має hash-pinned allowance лише для наявного synthetic TIFF розміром **100044 bytes**, без загального послаблення raw-data policy; **7 regression tests passed (1 approved fixture, 6 rejection cases)**. Координатор додає offline Playwright CI job: live test там explicit opt-in і skipped за замовчуванням; успішний remote CI run цим не заявляємо. Frontend: **45 unit/integration tests**, включно з **6 contract tests**; подробиці — у [FINAL_TEST_REPORT](docs/integration/FINAL_TEST_REPORT.md). Docker build/deploy не перевірено через permission denied до daemon; перевірено конфігурацію, не production runtime.

## Авторство, дані та ліцензування

Інтеграційний checkout базується на **`dbdb5be`** (data/backend/scene вже в base); інтеграційні зміни оформлюються окремими комітами в `feature/final-integration`. Фінальний SHA/push наведено у звіті інтегратора; merge у main і release цим не стверджуються.

- UI-дизайн і shell **Khrystyna**, source `a75d443b7ea347443a7d1f1ec159fe1841c6132f`, збережено вибірково з атрибуцією; branch не merged цілком, `demoSlots` не перенесено у головний застосунок.
- Попередній внесок **NASA JPL Horizons** збережено в `backend/LunarNavigator.Horizons/` і `Models/`; [документація, координати та обмеження](docs/horizons.md). Старі bootstrap counts у цьому історичному документі не є фінальним звітом.
- **HUM-02**, contribution `c960326`, merge `92de0e8` / PR #4: збережені `data/README.md`, Python/PowerShell acquisition scripts, raw placeholder і [DATA_SOURCES](docs/DATA_SOURCES.md#audit-caveat). Історичний complete не означає scientific readiness.
- CI source `892f4b8`: еквівалентну трирядкову зміну `fetch-depth: 0` перенесено вручну; це не merge усієї гілки.
- Командні ролі й беклоги: [TEAM_ASSIGNMENTS](TEAM_ASSIGNMENTS.md), [people](people/), [issues](issues/), [архів provenance](docs/archive/package-reconciliation.md). Не приписуємо всій команді незалежну перевірку datasets.

Код: [MIT License](LICENSE), copyright © 2026 anastasiiazuliak. NASA/JPL Horizons, NASA LRO/LOLA/PGDA та LROC мають окремі джерела й умови атрибуції: [DATA_SOURCES](docs/DATA_SOURCES.md), [SCIENCE_METHOD](docs/SCIENCE_METHOD.md). Згадка LROC — заплановане джерело, не наявна imagery. Перед submission люди мають перевірити ліцензії конкретних assets, авторські кредити та актуальні правила NASA Space Apps. Це не офіційний/схвалений NASA продукт; hosting, credentials, відео й submission потребують людського рішення.

## Review handoff

Інтеграція подана в [PR #15](https://github.com/anastasiiazuliak/byte-force/pull/15). GitHub підтвердив усі 8 CI checks для 5a6673a; точні runs і відмінність offline/live — у [test report](docs/integration/FINAL_TEST_REPORT.md). PR не змерджено автоматично; наукові/deployment blockers вище лишаються чинними.
