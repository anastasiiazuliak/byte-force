# COPY INTO CODEX — PERSON 3: Backend / Horizons

Ти агент #3 команди Lunar Navigator (NASA Space Apps Challenge 2026). **Починай негайно. Не чекай інших агентів.** Усі агенти мають окремі git worktree/branches, створені з одного стартового commit.

**Прочитай у пакеті:** `PARALLEL_CONTRACT.md`, `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/TRANSFORM.md`, `TEAM_SPEC.md` та `issues/<TASK-ID>.md` для всіх своїх ID. Заморожені контракти не редагуй; якщо їх немає в робочій копії — скопіюй із цього пакета, не чекай, поки хтось їх напише.

**Твої ID (внутрішній порядок; міжлюдських блокерів на старт немає):** `BE-01, BE-02, BE-06, BE-03, BE-04, BE-05`.

**Основний результат:** Твій deliverable: ASP.NET Core API відповідно до frozen OpenAPI. Визнач `ITerrainHeightProvider` і `IHorizonProfileProvider` в своєму Core Analysis module; Null/Unavailable adapters must refuse terrain-backed claims, return partial/null or proper error. Horizons parser and calculations tested independently. Map metadata can read a manifest file provided later, and until then report metadataVerified=false. Ні на хвилину не чекай #4.

**Правила:** код у власній зоні, no fake NASA production data, ізольовані адаптери для відсутніх модулів, tests, наукові caveats, ніяких push/merge/deploy без явного людського дозволу. Не змінюй app/Program.cs у чужому lane; замість цього додай інтеграційний хук і docs. Якщо tool/runtime недоступний, створюй компільовані файли й напиши чітку команду перевірки, не вигадуй що вона пройшла. По завершенні дай summary, тести, файли та малі інтеграційні інструкції.

## Твої таски з детальними промтами

# BE-01 — Реалізувати .NET API foundation, config та каталог місць

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `backend/LunarNavigator.Api/, backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №3 — Backend / Horizons  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №3
**Пріоритет:** P0  
**Залежності:** ARC-01, ARC-02  
**Область файлів:** `backend/LunarNavigator.Api/Controllers/`, `backend/LunarNavigator.Api/Program.cs`, `backend/LunarNavigator.Core/`, `backend/LunarNavigator.Tests/`

## Мета

Надати фронтенду стабільні початкові endpoints без залежності від наукових обчислень.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Реалізуй `GET /api/v1/health` з JSON `{status,version}`; не видавай зовнішні ресурси за healthy, якщо перевіряється лише вебсервер.
2. Реалізуй `GET /api/v1/config`: area [-90,-80], lon [-180,180], limits steps/samples/scenarios з налаштувань і feature-flags із фактично готових функцій.
3. Реалізуй `GET /api/v1/landing-sites` на основі локального JSON каталогу з id/name/description/lat/lon/sourceUrl; перевіряй координати, дублікати і джерела.
4. Створи versioned routing `/api/v1`, JSON camelCase, validation pipeline, однаковий ErrorResponse, CORS лише для конфігурованих origin.
5. Підключи DI-інтерфейси сервісів, не додаючи обчислення Horizons/LOLA сюди; async CancellationToken і логування без витоку internal secrets.
6. Створи unit/integration tests для endpoints, schema та помилок; для catalog із непідтверджених даних явно тримай DEMO label.
7. Запусти локально та вкажи curl приклади для перевірки кожного GET.

## Критерії приймання (Definition of Done)

- [ ] Роути повертають JSON згідно OpenAPI.
- [ ] Без інтернету стартує API і catalog.
- [ ] Невалідні координати catalog не потрапляють у відповідь.
- [ ] `dotnet test` зелений, у PR є curl підтвердження.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.


---

# BE-02 — Підключити JPL Horizons: локальні азимут/висота Сонця та Землі

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `backend/LunarNavigator.Api/, backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №3 — Backend / Horizons  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №3
**Пріоритет:** P0  
**Залежності:** ARC-02  
**Область файлів:** `backend/LunarNavigator.Core/Ephemeris/`, `backend/LunarNavigator.Api/Infrastructure/Horizons/`, `backend/LunarNavigator.Tests/Ephemeris/`

## Мета

Отримувати реальні Moon-observer топоцентричні положення Сонця і Землі для координат та UTC-часу.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Зроби `IEphemerisService` із методами обчислення для Location, Period, Step і CancellationToken; окремий `IHorizonsClient` для HTTP.
2. Перевір реальний JPL Horizons запит типу `EPHEM_TYPE=OBSERVER`, `CENTER=coord@301`, Moon site coordinate і кількості `QUANTITIES=4`. Узгодь формат longitude/latitude/heightKm, frame й команд Sun=10 / Earth=399 на живому прикладі.
3. Напиши надійний парсер: explicit `$$SOE/$$EOE`, час у UTC, пропуски/невизначені поля, десяткові роздільники, фактичні columns, error result; не парсь HTML і не залежи від фіксованих пробілів.
4. Додай configurable HttpClient, timeout, retry з помірним backoff, cancellation, обмеження кількості samples і local cache за параметрами запиту.
5. Нормалізуй кут азимута/висоти в узгодженій Moon frame, зафіксуй interpretation на полюсі; не переплутай топоцентричні кути з Moon-fixed векторами.
6. Не вигадуй астрономічні числа при помилці Horizons; повертай typed failure для сервісного шару, логуй без секретів.
7. Зроби unit tests парсера на збережених текстових прикладах відповіді та інтеграційний smoke з реальним API, який можна вимкнути для offline CI.

## Критерії приймання (Definition of Done)

- [ ] Сервіс повертає Sun/Earth azimuth/elevation для кількох контрольних UTC моментів.
- [ ] На невалідні або часткові відповіді API немає вигаданих значень.
- [ ] Є fixture-driven unit tests і задокументований live smoke.
- [ ] Результати типізовані та сумісні з ARC-02.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.


---

# BE-06 — Реалізувати GET /map/metadata для синхронізації 3D mesh, CRS та static URLs

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `backend/LunarNavigator.Api/, backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №3 — Backend / Horizons  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №3
**Пріоритет:** P0  
**Залежності:** ARC-02, ARC-03, DATA-03  
**Область файлів:** `backend/LunarNavigator.Api/Controllers/MapController.cs`, `backend/LunarNavigator.Core/Map/`, `backend/LunarNavigator.Tests/Map/`

## Мета

Повернути Frontend одну реальну, валідну конфігурацію рельєфу, яку можна завантажити без жодного здогаду про координати.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Реалізуй `GET /api/v1/map/metadata` на основі manifest, створеного DATA-03; у P0 це може бути один підготовлений root tile, у P1 він розшириться на tile LOD.
2. Контракт відповіді з ARC-02: `regionId`, `projection` (точний Moon polar CRS), `render` (type/extent/sceneTransform/tileSize/minZoom/maxZoom), `assets` (URL-шаблони або явний список root assets), `terrainDataset` (source/datum/resolution/coverage).
3. Не видавай `<REPLACE...>` і випадкові bounding box числа з прикладів TEAM_SPEC як production values — бери все з real manifest та координатного контракту ARC-03.
4. Перед стартом/відповіддю валідовуй, що JSON manifest читається, версія сумісна, target static GLB існує в деплої; при відсутності assets видавай typed unavailable/error, а не фейковий URL.
5. Забезпеч одну base URL strategy: frontend використовує метадані й не хардкодить шляхи тайлів; static файли віддає static server, не цей контролер.
6. Зроби тести valid metadata / missing manifest / wrong CRS or transform / version mismatch / coverage bounds. Документуй оновлення manifest при DATA-04.
7. Погодь JSON schema з FE3D-02 до merge, але не змінюй його без окремого contract PR.

## Критерії приймання (Definition of Done)

- [ ] `GET /map/metadata` повертає реальні координати/URL для demo GLB.
- [ ] Відповідь проходить JSON schema/контракт.
- [ ] Не видаються неіснуючі assets або невідомі висотні системи як валідні.
- [ ] При оновленні LOD весь існуючий P0 залишається сумісним.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.


---

# BE-03 — Реалізувати POST /analyze: горизонти, видимість, інтервали, summaries

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `backend/LunarNavigator.Api/, backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №3 — Backend / Horizons  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №3
**Пріоритет:** P0  
**Залежності:** BE-02, DATA-02, ARC-02  
**Область файлів:** `backend/LunarNavigator.Core/Analysis/`, `backend/LunarNavigator.Api/Controllers/AnalysisController.cs`, `backend/LunarNavigator.Tests/Analysis/`

## Мета

Об’єднати ефемериди та LOLA, повертати фронтенду одну завершену наукову відповідь для точки й періоду.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Реалізуй `POST /api/v1/analyze`: location, period(start/end/step), options(terrainModel=lola,includeHorizon). Валідуй bounds, order times, maxSamples, finite numeric, дату UTC.
2. Отримай висоту точки/NoData з TerrainService, правильно перетвори height datum для Horizons; не підставляй земні чи неперевірені величини.
3. Отримай `sun` і `earth` ephemeris samples; у HorizonService вибери висоту рельєфного горизонту за азимутом (з інтерполяцією профілю) і визнач `clearanceDeg = elevationDeg - horizonDeg`.
4. `visible` — видимість центра диска за обраним визначенням тільки при `terrainApplied=true`. При відсутності terrain постав `visible:null`, `status:partial`, warnings, а не true за elevation>0.
5. За samples отримай `intervals.sunVisible`/`earthVisible` й summary hours/percent/both; інтервали [start,end), не виходять за period. Для crossings явно задокументуй припущення інтерполяції.
6. Формуй `horizon.points` 360° (або узгоджений крок) тільки якщо option=true; `quality` описує data sources, terrain resolution, method, warnings, timestamps.
7. Повертай structured API errors з ARC-02; cache expensive horizon profiles через сервіс, без cache stale entire responses при зміні даних.
8. Тести: Сонце над/під рельєфним горизонтом, near-zero clearance, частковий результат, пропущений step, періоди 0/100% та кросинг меж.

## Критерії приймання (Definition of Done)

- [ ] Повний JSON проходить contract validation.
- [ ] Часові ряди упорядковані; summary узгоджений із intervals.
- [ ] Немає false-positive `visible` без terrainApplied.
- [ ] Тести обробляють NoData/помилки Horizons/кривизну через mock services.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.


---

# BE-04 — Реалізувати POST /compare та узгоджені метрики A/B

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `backend/LunarNavigator.Api/, backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №3 — Backend / Horizons  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №3
**Пріоритет:** P0  
**Залежності:** BE-03, ARC-02  
**Область файлів:** `backend/LunarNavigator.Core/Comparison/`, `backend/LunarNavigator.Api/Controllers/ComparisonController.cs`, `backend/LunarNavigator.Tests/Comparison/`

## Мета

Дати користувачу можливість швидко порівняти два місця за той самий час або одне місце за різні періоди.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Створи `POST /api/v1/compare`, що приймає рівно два scenarios з id A/B, location і period. Зафіксуй options lola/includeHorizon або їх default згідно OpenAPI.
2. Пере-використовуй AnalysisService, не копіюй Horizons/LOLA алгоритми в контролер. Для сценаріїв використовуй незалежні CancellationToken та validation.
3. Повертай `scenarios: [{id,analysis}]`, де analysis тотожний повному `/analyze` response, і `differences` за визначенням B−A для годин/відсотків.
4. Якщо періоди різної довжини, явно додай/використай duration і відсоткове порівняння; не називай B "кращим" без критеріїв.
5. Визнач поведінку при partial/failure: JSON обох із quality/status або контролювана помилка, не підміняти невідоме нулем.
6. Додай cache для ідентичних analysis, тести A=B, B більш/менш видимий, different durations, errors, deterministic order A/B.
7. Онови API docs curl прикладами й перевір сумісність із контрактом.

## Критерії приймання (Definition of Done)

- [ ] Працює both modes: same-time different-location і same-location different-time.
- [ ] Різниця завжди B−A, без автоматичного неаргументованого winner.
- [ ] `analysis` містить повні samples/intervals/quality/horizon.
- [ ] `dotnet test` для comparison зелений.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.


---

# BE-05 — POST /ephemeris: перевірені Moon-fixed напрями для освітлення 3D

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `backend/LunarNavigator.Api/, backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №3 — Backend / Horizons  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №3
**Пріоритет:** P1  
**Залежності:** BE-02, ARC-03  
**Область файлів:** `backend/LunarNavigator.Core/Ephemeris/MoonFixed/`, `backend/LunarNavigator.Api/Controllers/EphemerisController.cs`, `backend/LunarNavigator.Tests/Ephemeris/`

## Мета

Повернути напрямні вектори Сонця та Землі для стабільного освітлення всієї 3D-сцени, а не тільки локальної точки.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Узгодь із DATA/FE3D точну Moon-fixed систему (наприклад, MOON_ME, якщо підтверджена), осі, позитивні напрями, епоху й перетворення в sceneXYZ.
2. Реалізуй `POST /api/v1/ephemeris` з start/end/step; повертай масив `{timeUtc,sunDirection:[x,y,z],earthDirection:[x,y,z]}` + referenceFrame, vectorConvention, quality.
3. Не використовуй локальну ENU-координату однієї точки для освітлення всієї полярної ділянки. Якщо потрібна трансформація Horizons/SPICE — документуй джерело та тест.
4. Нормалізуй 3-вектори до 1; запобігай NaN/Infinity, guard missing ephemerides.
5. Узгодь спільний час із `/analyze`, щоб scrub не суперечив показникам положення Сонця.
6. Додай перевірені контрольні вектори або незалежні геометричні інваріанти; якщо точну трансформацію не перевірено — feature flag `moonFixedEphemeris=false` і не видавати неправдивий real-data результат.

## Критерії приймання (Definition of Done)

- [ ] Вектори нормалізовані та мають конкретну задокументовану систему відліку.
- [ ] Тести на синхронізацію часу та коректність осей.
- [ ] Endpoint не приховує fallback/unknown accuracy.
- [ ] З `moonFixedEphemeris=true` проходить перевірка інтеграції з 3D.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.


---

