# FEUI-03 — Зробити Analysis Panel: картки, графіки, 360° horizon view

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `frontend/src/features/{scenario-form,analysis,timeline,compare,methodology,export}/, frontend/src/components/, frontend/src/styles/, frontend/src/app/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №2 — UI Frontend  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №2
**Пріоритет:** P0  
**Залежності:** FEUI-01, ARC-02  
**Область файлів:** `frontend/src/features/analysis/`

## Мета

Перетворити `AnalysisResponse` у зрозумілі наукові візуалізації та пояснення.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. На вході typed `AnalysisResponse` як props; окремо layout/cards, charts, horizon profile/sky indicator, source-quality badge.
2. У картках відображай sun elevation, earth elevation, relative horizon clearance, visible/blocked/unknown, тривалість/відсоток і обраний timestamp UTC.
3. Chart.js (або обраний chart library) будує часові ряди elevationDeg/horizonDeg для Sun/Earth; осі/легенди/tooltip явно в градусах та UTC.
4. SVG/Canvas horizon view будує силует з `horizon.points` (azimuth 0..360) і проєктує Sun/Earth у відповідний азимут та висоту на selectedTime.
5. Не плутай `elevationDeg` і `horizonDeg`: якщо Earth на +4°, а horizon на +6° — відображай “Blocked by terrain”.
6. При `quality.terrainApplied=false` відображай “Terrain not considered”; невідомий `visible:null` не перетворюй на доступний.
7. При incomplete samples обробляй графіки без краху; показуй метод, джерела, ілюстративність fixture лише в dev/mock.
8. Перевір доступність кольорів (колір + текст + значок), tooltip і keyboard navigation; додавай snapshot/unit tests.

## Критерії приймання (Definition of Done)

- [ ] `samples`/`summary`/`horizon`/`quality` відображаються окремо та узгоджено.
- [ ] Графіки працюють із повними й частковими даними.
- [ ] Видимість з рельєфом та geometric elevation не сплутані.
- [ ] UI не падає від null/empty intervals.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
