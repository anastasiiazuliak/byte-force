# DATA-03 — Зробити offline DEM → один реальний 3D mesh GLB для demo-ділянки

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `data-pipeline/, public-assets/, backend/LunarNavigator.Core/{Terrain,Horizon}/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №4 — LOLA / Data  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №4
**Пріоритет:** P0  
**Залежності:** HUM-02, ARC-03  
**Область файлів:** `data-pipeline/terrain_mesh/`, `data-pipeline/README.md`, `public-assets/terrain/0/0/0.glb`, `public-assets/metadata/`

## Мета

Швидко дати Frontend 3D справжню об’ємну ділянку, щоб команда перевірила UX до масштабного LOD-проєкту.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Напиши відтворюваний Python/GDAL або інший CLI pipeline, який читає обмежене DEM вікно і генерує GLB mesh із реальних висот (не flat PNG plane).
2. Масштаб X/Y/height фізично узгоджений, без перебільшення вертикалі за замовчуванням; локальна позиція/оригін описані в manifest.
3. Додай UV/normals, texture optional; узгодженість з CRS та lat/lon: контрольні точки мають потрапляти на mesh.
4. Збережи невеликий demo asset для CI/staging; великі output assets винеси в static hosting.
5. Зроби cli з аргументами source DEM, bounds/site, resolution, output, optional imagery, щоб генерація повторювалася.
6. Додай manifest JSON з boundsProjectedMeters, bounds lat/lon, source dataset, reference frame, meshLocalOrigin, file size, attribution.
7. Перевір GLB через glTF validator/three.js loader і приклади відкриття; знімок сцени додай до PR.
8. Не створюй тисячі tiles до перевірки Data/3D інтерфейсу й продуктивності.

## Критерії приймання (Definition of Done)

- [ ] Справжній рельєф одного полярного району відкривається в Three.js.
- [ ] GLB існує/має manifest, не перевантажує браузер.
- [ ] Координата на mesh може бути відновлена до lat/lon.
- [ ] Команда може перегенерувати asset із задокументованою CLI командою.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
