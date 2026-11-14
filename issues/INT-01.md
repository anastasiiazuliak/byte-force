# INT-01 — Підготувати frontend API client, mocks та contract tests

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `frontend/src/{api,mocks,integration}/, frontend/e2e/, infra/, .github/, scripts/, docs/integration/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №5 — Інтегратор / CI / QA
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №5
**Пріоритет:** P0
**Залежності:** ARC-02, ARC-01
**Область файлів:** `frontend/src/api/`, `frontend/src/mocks/`, `frontend/src/api/__tests__/`

## Мета

Дати FE команді стабільні типізовані запити та синтетичні дані, поки BE пише реальну логіку.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Реалізуй `getConfig/getLandingSites/getMapMetadata/analyze/compare/getEphemeris` через один fetch client із typed request/response, abort signal, endpoint base і ErrorResponse.
2. Якщо schema-generated types доступні — використовуй їх, не заводь дублюючих TS interface.
3. Додай mock transport / MSW тільки для dev/tests; синтетичні fixtures з contracts/fixtures із очевидним прапорцем demo, вимкнені у production за замовчуванням.
4. При HTTP 4xx/5xx показуй на верхній шар ErrorResponse(code,message,details), network timeout/abort не плутай із server error.
5. Додай response-shape contract tests та 2–3 приклади запитів, узгоджених з TEAM_SPEC.
6. Вироби clear API for FEUI hooks/selectors і cache keys по location+period+options; жодної неузгодженої авторизації.
7. Забезпеч base URL із env та dev proxy, перевір TS build.

## Критерії приймання (Definition of Done)

- [ ] UI може викликати `analyze` і `compare` через mocks.
- [ ] Немає дубльованих DTO або захардкожених localhost у production.
- [ ] ErrorResponse відображається типізовано.
- [ ] Є тести формату контракту.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
