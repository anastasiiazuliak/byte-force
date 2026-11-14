# OPS-02 — Задеплоїти API, UI та static 3D/imagery assets одним публічним URL

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `frontend/src/{api,mocks,integration}/, frontend/e2e/, infra/, .github/, scripts/, docs/integration/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №5 — Інтегратор / CI / QA
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №5
**Пріоритет:** P0
**Залежності:** HUM-03, INT-02, OPS-01, DATA-03
**Область файлів:** `infra/`, `docs/DEPLOYMENT.md`, `frontend/.env.example`, `backend/*`

## Мета

Дати журі стабільний HTTPS-застосунок із справжніми даними та продуктивною роздачею картографічної статики.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Підготуй docker/multi-stage builds або documented production deploy: frontend Vite static, backend ASP.NET Core, окремий static hosting для GLB/WebP.
2. Налаштуй reverse proxy: `/api/v1/*` → backend, `/terrain/*` та `/tiles/*` → static files, інші → frontend SPA fallback.
3. Увімкни gzip/br для JSON/JS/CSS, caching & immutable headers для versioned tile assets, коректні MIME `model/gltf-binary`, `image/webp`.
4. Налаштуй readiness/health, API timeout для Horizons, CORS мінімально потрібний, HTTPS, no secrets in image/Git.
5. Створи sample env і deploy guide з командами upgrade/restart/revert.
6. Перевір реальний mobile/non-local network доступ, завантаження GLB, analyze і compare.
7. Якщо великий DEM не може працювати на production backend, задокументуй межу і виріши staging persistent storage/processed horizon cache; не видавай unavailable для всіх за complete.

## Критерії приймання (Definition of Done)

- [ ] Публічний URL відкриває 3D-сцену, аналіз і порівняння.
- [ ] GLB та WebP віддаються з правильним MIME і cache.
- [ ] Є README для відтворюваного деплою.
- [ ] API errors не показують секретів/stacktrace.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
