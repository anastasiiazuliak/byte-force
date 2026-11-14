# ARC-01 — Підняти монорепозиторій: React, .NET 8, data-pipeline, contracts

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `frontend/src/{api,mocks,integration}/, frontend/e2e/, infra/, .github/, scripts/, docs/integration/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №5 — Інтегратор / CI / QA  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №5
**Пріоритет:** P0  
**Залежності:** HUM-01  
**Область файлів:** `frontend/`, `backend/`, `data-pipeline/`, `contracts/`, `infra/`, `docs/`, `.gitignore`, `README.md`

## Мета

Створити каркас проєкту, у якому п’ять розробників можуть працювати в ізольованих директоріях і запускати все однією інструкцією.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Створи frontend/ із React+TypeScript+Vite, працюючим lint/build і порожнім AppShell; backend/ з ASP.NET Core Web API .NET 8, Core/Api/Tests; data-pipeline/, contracts/, docs/, infra/.
2. Налаштуй локальний Vite proxy з /api на .NET; збережи API URL/env у frontend/.env.example без секретів.
3. Додай backend конфігурацію через appsettings + env, структуроване логування, cancellation tokens для HTTP і graceful errors.
4. Додай кореневий README із командами setup, dev, test, build, інструкціями для Linux/Windows і де брати NASA дані.
5. Створи scripts/dev.sh або рівноцінну portable інструкцію, що не вимагає прихованих глобальних налаштувань.
6. Забезпеч compile-ready стани фронту і бекенду в окремих директоріях, без уявних npm-пакетів і незареєстрованих native dependencies.
7. Додай мінімальний smoke `/api/v1/health`, якщо це потрібно для першого запуску, але не реалізовуй логіку BE-01.

## Критерії приймання (Definition of Done)

- [ ] `npm install && npm run build` у frontend/ проходить.
- [ ] `dotnet restore && dotnet test && dotnet build` у backend/ проходить.
- [ ] Є gitignore, README і .env.example.
- [ ] Компоненти можна запускати незалежно.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
