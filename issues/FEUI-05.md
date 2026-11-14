# FEUI-05 — Створити Compare Mode для двох місць або різних дат

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `frontend/src/features/{scenario-form,analysis,timeline,compare,methodology,export}/, frontend/src/components/, frontend/src/styles/, frontend/src/app/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №2 — UI Frontend  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №2
**Пріоритет:** P0  
**Залежності:** FEUI-03, FEUI-04, ARC-02  
**Область файлів:** `frontend/src/features/compare/`

## Мета

Зробити головну цінність NASA — порівняння сценаріїв — максимально швидкою і зрозумілою.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Зроби Explore/Compare toggle, кнопку “Add B”, два коротких summary панелі A/B, відмінності sunVisibleHours, earthVisibleHours, bothVisibleHours.
2. Підтримуй порівняння двох location при одній даті/періоді та однієї location при різних date ranges.
3. Графіки A/B мають окреме чітке маркування; для однакових дат можна спільну UTC вісь, для різних — вибір relative offset vs absolute UTC із поясненням.
4. Не показуй автоматичний “winner” без параметрів місії; різниця B−A повинна відображати знаки, одиниці і duration.
5. Використовуй API `/compare`; якщо він ще не готовий, typed fallback на два `/analyze` із тими самими schemas і local B−A.
6. Partial/failed scenario не можна трактувати як 0 годин освітлення; показати невідоме і warnings.
7. Зроби swap A↔B, copy scenario, reset comparison, збереження selection state при перемиканні.
8. Тести: A=B, different periods, one partial, 0% /100%, довгий locale/назва точки.

## Критерії приймання (Definition of Done)

- [ ] Обидва режими порівняння працюють.
- [ ] Можна вибрати дві точки без втрати даних A.
- [ ] Коректна математика B−A й повідомлення про невизначеність.
- [ ] Порівняння читабельне на мобільному.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
