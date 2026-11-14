# Людина №5 — Інтегратор / CI / QA

> Актуалізація parallel v2 на основі [готової персональної сторінки](../../people/PERSON-05.md). Список задач, їхні ID та пріоритети збережено. Історичні блокери старту скасовані [START_ALL_5](../../START_ALL_5.md): **починай одразу**, незалежно від готовності інших lane.

**Гілка:** `feature/lane-5`, власний clone від того самого погодженого commit `main`, що й решта команди. [Git workflow](../integration/team-workflow.md).

**Повний готовий prompt:** [PERSON-05-PASTE-INTO-CODEX](../../prompts/PERSON-05-PASTE-INTO-CODEX.md). Передай його агенту цілком; не запускай окремих агентів на кожен Issue в одному каталозі.

**З ким узгоджувати:** Всі учасники: shared API/coordinate decisions, PR integration, CI та деплой; №5 координує HUM-04, але презентують усі.

## Ownership

`frontend/src/{api,mocks,integration}/**`, `frontend/e2e/**`, `infra/**`, `.github/**`, `scripts/**`, `docs/integration/**`. Не переписуй UI app shell, explorer, backend services і frozen contracts.

Якщо старий Issue називає файл поза цією зоною, погодь зміну з власником. Не перенось межі самовільно. Спільну документацію змінюйте координовано.

## Прочитати до коду

[ТЗ](../TEAM_SPEC.md), [PARALLEL_CONTRACT](../../PARALLEL_CONTRACT.md), [OpenAPI](../../contracts/openapi.yaml), [DTO / LunarApiClient](../../contracts/api-types.ts), [scene types](../../contracts/scene/scene-types.ts), [transform](../../contracts/scene/TRANSFORM.md), свій prompt і всі свої Issues нижче. Frozen v2 перемагає старі ілюстративні JSON. Не створюй власних копій несумісних DTO.

## Персональний беклог (без нових задач)

| Порядок | ID | Пріоритет | Назва | Залежності фінальної інтеграції (не старту) |
|---:|---|---|---|---|
| 1 | [HUM-01](../../issues/HUM-01.md) | **P0** | Створити GitHub-репозиторій, доступи та правила паралельної роботи | немає |
| 2 | [ARC-01](../../issues/ARC-01.md) | **P0** | Підняти монорепозиторій: React, .NET 8, data-pipeline, contracts | HUM-01 |
| 3 | [ARC-02](../../issues/ARC-02.md) | **P0** | Зафіксувати OpenAPI, TypeScript DTO та реалістичні тестові fixtures | ARC-01 |
| 4 | [HUM-03](../../issues/HUM-03.md) | **P0** | Обрати й підготувати демо-хостинг, домен та секрети | HUM-01 |
| 5 | [INT-01](../../issues/INT-01.md) | **P0** | Підготувати frontend API client, mocks та contract tests | ARC-02, ARC-01 |
| 6 | [OPS-01](../../issues/OPS-01.md) | **P0** | Налаштувати CI: build, lint, test, OpenAPI validation і PR-checks | ARC-01, ARC-02 |
| 7 | [INT-02](../../issues/INT-02.md) | **P0** | Підключити реальний API до 3D та UI для end-to-end сценарію | INT-01, BE-03, FE3D-03, FEUI-03 |
| 8 | [OPS-02](../../issues/OPS-02.md) | **P0** | Задеплоїти API, UI та static 3D/imagery assets одним публічним URL | HUM-03, INT-02, OPS-01, DATA-03 |
| 9 | [QA-01](../../issues/QA-01.md) | **P0** | Зробити наскрізні тести: вибір місця, дата, аналіз, compare, збої | INT-02, BE-04, FEUI-05 |
| 10 | [HUM-04](../../issues/HUM-04.md) | **P0** | Підготувати презентацію, демонстраційний сценарій і подачу NASA | QA-01, OPS-02 |

Порядок — внутрішній орієнтир, а не міжлюдський блокуючий pipeline. Почни з P0; P1/P2 — після робочого основного сценарію. Відсутню суміжну реалізацію закривай typed adapter/stub **у своїй зоні** з integration pending. `HUM-*` із доступами, отриманням/ліцензуванням даних, secrets або submission потребують людини й дозволу.

## Frozen interfaces та передача

Надай `createApiClient` і `createConfiguredClient` через `frontend/src/integration/client`, mock client, contract tests і окремий e2e harness. Зберігай frozen `LunarApiClient`: `health`, `config`, `landingSites`, `mapMetadata`, `analyze`, `compare`, `ephemeris`. Нові `getHealth/getConfig/getLandingSites/getMapMetadata` та підтримка `AbortSignal` — convenience extension, не редагування frozen інтерфейсу. Mock лише з явним `VITE_USE_MOCKS=true` у development, ніколи в production; real errors не підміняй synthetic success. Остаточне app/provider wiring — після merge із власниками.

Не редагуй `contracts/**` у першій незалежній хвилі. Потребу зміни подай як `contract-change-request.md` у погодженій власній docs-зоні та запроси review impacted owners.

Спільні інваріанти: UTC із `Z`, latitude `[-90,-80]`, longitude `[-180,180]`, azimuth `[0,360)`, інтервали `[startUtc,endUtc)`, compare **B−A**. `visible:null` — unknown, `terrainApplied=false` — не підтверджена рельєфна видимість. Не видавай synthetic fixtures/mesh/світло за NASA; не замінюй unknown на нуль або success.

## Валідація свого результату

З `frontend/`: `npm install`, `npm run build`, `npm test`, `npm run test:contracts`; перевір frozen fixture/schema відповідність, aliases, cancellation, real errors, явний mock opt-in і production mocks off. CI має jobs `frontend` / `backend`; e2e test double не дорівнює реальному E2E. Для backend перевірки використовуй solution-команди з README.

Для frontend-змін також виконай доступні `npm run build`, `npm test`, `npm run test:contracts` з `frontend/`. Якщо starter ще не має scripts/runtime/dependencies, наведи точну помилку та pending, а не вигаданий passed. Інструкції запуску Linux/Windows — у [README](../../README.md).

## Definition of handoff

- Посилання на існуючі task ID, результат і перелік змінених власних файлів.
- Точні фактично виконані команди, результати/логи; незапущені перевірки з причиною.
- Публічні експорти, props/providers/manifest, короткі кроки підключення і що лишилося integration pending.
- Джерела/quality/caveats, ризики, людські дії. Жодних secrets або великих DEM/GLB у Git.
- PR із незалежним review; оновлення через `git fetch origin` і `git merge origin/main`, без force push. Не commit/push/merge/deploy без явного доручення.

Ця сторінка — інструкція, **не звіт про завершення задач чи успішні перевірки**. Фінальні validation claims робляться лише батьківською інтеграцією за реальними результатами після з’єднання lane.
