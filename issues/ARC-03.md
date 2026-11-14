# ARC-03 — Затвердити місячні координати, висотну базу, scene-transform і tile grid

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `data-pipeline/, public-assets/, backend/LunarNavigator.Core/{Terrain,Horizon}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №4 — LOLA / Data  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №4
**Пріоритет:** P0  
**Залежності:** ARC-02, HUM-02  
**Область файлів:** `docs/COORDINATES_AND_TILES.md`, `contracts/fixtures/coordinate-control-points.json`, `contracts/tiles.schema.json`

## Мета

Усунути найризикованішу точку інтеграції: різні уявлення тих самих координат у LOLA, Horizons та Three.js.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. З gdalinfo реального GeoTIFF опиши CRS, вісь X/Y, bounds, pixel origin/size, одиниці висоти, no-data, опорну сферу/датум; зберігай точні метадані.
2. Узгодь зовнішні lat/lon [-90,-80], [-180,180], long direction і внутрішнє перетворення у проєктні метри та Three.js X/Y/Z.
3. Укажи локальний origin 3D mesh (center або SW corner), вертикальний масштаб = 1 фізична одиниця за замовчуванням, де робиться rebasing для точності float.
4. Затверди z/x/y zoom grid, tile extents, TMS/XYZ-orientation, texture UV/orientation та LOD semantics; визнач format metadata для sceneTransform і розміщення tile meshes.
5. Поясни особливу ситуацію азимута точно на 90°S, де географічна північ/довгота втрачають звичайний сенс; не використовувати мовчазні ділення на cos(lat).
6. Створи 5–8 контрольних точок із відомими lon/lat ↔ projectXY ↔ sceneXYZ + допусками, включно з краєм покриття.
7. Зроби автоматичні round-trip тести проєкції та контрольного кліку. Передай контракт BE/DATA і FE3D, заблокуй масову генерацію GLB до затвердження.

## Критерії приймання (Definition of Done)

- [ ] Є одна схема осей/одиниць/LOD, погоджена обома сторонами.
- [ ] Контрольні точки проходять round-trip із задокументованою похибкою.
- [ ] Немає WGS84/EPSG:3857 замість Moon polar projection.
- [ ] Все, що ще не перевірено, явно позначено TBD.

## Обмеження

Не генерувати великий набір mesh тайлів до підтвердження цієї задачі.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
