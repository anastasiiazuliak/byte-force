# DATA-01 — Підключити NASA LOLA GeoTIFF через GDAL і читати висоту за координатами

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `data-pipeline/, public-assets/, backend/LunarNavigator.Core/{Terrain,Horizon}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №4 — LOLA / Data  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №4
**Пріоритет:** P0  
**Залежності:** HUM-02, ARC-03  
**Область файлів:** `backend/LunarNavigator.Core/Terrain/`, `backend/LunarNavigator.Api/Infrastructure/Terrain/`, `backend/LunarNavigator.Tests/Terrain/`

## Мета

Побудувати надійний terrain read layer без завантаження DEM у RAM цілком.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Реалізуй `ITerrainService.GetElevationAsync(Location)` і `GetWindowAsync(...)` або sync GDAL behind service відповідно до thread-safety, але зовнішній контракт async/cancellable.
2. Використовуй exact CRS/GeoTransform із TIF; перетворення Moon lat/lon -> projected XY -> raster pixel, без земних проєкцій за замовчуванням.
3. Знайди й перевір NoData, extent, float sample, обережно з округленням pixel center, interpolation method; поза областю поверни typed Result, не 0.
4. Висоту поверни в метрах з перевіреним reference datum; окремо документуй mapping до heightKm для Horizons. Не використовуй припущення про sea level.
5. Забезпеч thread-safety GDAL handles при паралельних HTTP запитах, кешування малих raster windows і cleanup native resources.
6. Створи gdalinfo fixture та контрольні точки, round-trip near edge; перевір широту -90.0 і lon wrap ±180.
7. Додай startup validation про відсутні файли; `/health` не має аварійно падати через опціональні NASA assets.

## Критерії приймання (Definition of Done)

- [ ] 5+ контрольних координат повертають стабільні значення висоти/NoData.
- [ ] Сервіс не читає повний TIF на кожному запиті.
- [ ] Висота й система відліку задокументовані.
- [ ] Тести на координати, краєві значення й native resource cleanup.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
