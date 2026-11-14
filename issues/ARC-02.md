# ARC-02 — Зафіксувати OpenAPI, TypeScript DTO та реалістичні тестові fixtures

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `frontend/src/{api,mocks,integration}/, frontend/e2e/, infra/, .github/, scripts/, docs/integration/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №5 — Інтегратор / CI / QA
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №5
**Пріоритет:** P0
**Залежності:** ARC-01
**Область файлів:** `contracts/openapi.yaml`, `contracts/fixtures/`, `frontend/src/api/types.ts`, `backend/LunarNavigator.Core/Contracts/`, `docs/CONTRACT_DECISIONS.md`

## Мета

Зробити єдине джерело правди для всієї команди, щоб Codex-агенти не винаходили несумісні поля JSON.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Прочитай docs/TEAM_SPEC.md §§5–7; створюй schema-first OpenAPI 3.x для `/api/v1/health`, `/config`, `/landing-sites`, `/map/metadata`, `/ephemeris`, `/analyze`, `/compare` і помилок; позначай optional endpoints.
2. Описати DTO: Location, Period, AnalysisOptions, BodyPosition, HorizonPoint, AnalysisSample, Interval, Quality, AnalysisResponse, CompareResponse, MapMetadata, EphemerisResponse, ErrorResponse.
3. Уточнити `visible: boolean|null` при неповному terrain; `terrainApplied`, UTC з Z, одиниці, азимут [0,360), interval [start,end), різниця B−A.
4. Зафіксувати demo fixtures для A/B, валідного аналізу й помилок; підписати, що значення синтетичні, не з NASA. Підсумки повинні узгоджуватися з інтервалами та загальною тривалістю.
5. Автоматично згенеруй TS types зі schema або напиши типи й тести schema equivalence. Backend DTO має бути сумісний із contract та JSON camelCase.
6. У docs/CONTRACT_DECISIONS.md окремо записати поки що відкриті питання Moon-frame, height datum, LOD grid. Не підставляти випадкові точні значення.
7. Перевірити OpenAPI валідатором; додати тест, який перевіряє fixtures проти схем.
8. Відкрити PR як контракти першої хвилі; всі інші завдання беруть схеми, а не самостійно змінюють назви.

## Критерії приймання (Definition of Done)

- [ ] Усі P0 маршрути й JSON DTO задокументовано.
- [ ] Є зразки success/partial/error, валідні за OpenAPI.
- [ ] Фронт має types, бек має DTO або описану процедуру генерації.
- [ ] Задокументовані неузгоджені рішення без вигаданих констант.

## Обмеження

Не запускати масову реалізацію бізнес-логіки в межах цієї задачі. Зміни OpenAPI надалі тільки через узгоджений PR.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
