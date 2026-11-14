# HUM-01 — Створити GitHub-репозиторій, доступи та правила паралельної роботи

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `frontend/src/{api,mocks,integration}/, frontend/e2e/, infra/, .github/, scripts/, docs/integration/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №5 — Інтегратор / CI / QA  
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №5
**Пріоритет:** P0  
**Залежності:** Немає  
**Область файлів:** `GitHub repository settings`, `README.md`, `docs/TEAM_SPEC.md`

## Мета

Підготувати безпечне спільне місце роботи до запуску декількох Codex-агентів і п’яти учасників.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Створи один репозиторій lunar-navigator; надай всім п’ятьом доступ із необхідними правами, визнач власника фінального merge.
2. Створи гілку main із захистом від прямого push, увімкни PR review і за можливості статус CI як обов’язковий; розробка — окремі гілки feature/<TASK-ID>-<slug>.
3. Додай docs/TEAM_SPEC.md із наданого файлу та issues/ або посилання на цей беклог. Перевір, що обидва джерела доступні кожному учаснику та агенту.
4. Домовся: один task = одна гілка = один PR; PR описує зроблене, змінені контракти, тести та скрин/відео для UI.
5. Додай .gitignore для node_modules, bin/obj, build/dist, env, кешів, великих .tif/.glb/.webp, тимчасових DEM та секретів. Винятки — лише свідомо вибрані невеликі демо-ресурси.
6. Визнач правило блокувань: якщо task потребує зміни чужого API або директорії — окремий PR/узгодження, а не самовільне переписування.
7. У GitHub Projects заведи колонки Backlog, Ready, In Progress, Review, Done, Blocked; познач task ID в issue та PR.

## Критерії приймання (Definition of Done)

- [ ] Усіх 5 учасників додано, репозиторій доступний.
- [ ] Є TEAM_SPEC, цей backlog та перевірена інструкція branching/PR.
- [ ] Немає ключів і сирих великих NASA-даних у Git.
- [ ] Два розробники можуть одночасно відкривати PR без змін у спільних feature-файлах.

## Обмеження

Це людська організаційна задача; не запускати gh auth/створення репозиторію агентом без дозволу власника.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
