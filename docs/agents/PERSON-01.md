# Людина №1 — 3D Frontend

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../integration/team-workflow.md) and [data caveat](../DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> Актуалізація parallel v2 на основі [готової персональної сторінки](../../people/PERSON-01.md). Список задач, їхні ID та пріоритети збережено. Історичні блокери старту скасовані [START_ALL_5](../../START_ALL_5.md): **починай одразу**, незалежно від готовності інших lane.

**Гілка:** `feature/lane-1`, власний clone від того самого погодженого commit `main`, що й решта команди. [Git workflow](../integration/team-workflow.md).

**Повний готовий prompt:** [PERSON-01-PASTE-INTO-CODEX](../../prompts/PERSON-01-PASTE-INTO-CODEX.md). Передай його агенту цілком; не запускай окремих агентів на кожен Issue в одному каталозі.

**З ким узгоджувати:** ARC-03 (трансформації й координати), DATA-03/04 (GLB та LOD), FEUI-04 (час), BE-05 (напрямки світла).

## Ownership

`frontend/src/features/explorer/**`, `docs/3d/**`. Не редагуй app shell, UI, backend і frozen contracts.

Якщо старий Issue називає файл поза цією зоною, погодь зміну з власником. Не перенось межі самовільно. Спільну документацію змінюйте координовано.

## Прочитати до коду

[ТЗ](../TEAM_SPEC.md), [PARALLEL_CONTRACT](../../PARALLEL_CONTRACT.md), [OpenAPI](../../contracts/openapi.yaml), [DTO / LunarApiClient](../../contracts/api-types.ts), [scene types](../../contracts/scene/scene-types.ts), [transform](../../contracts/scene/TRANSFORM.md), свій prompt і всі свої Issues нижче. Frozen v2 перемагає старі ілюстративні JSON. Не створюй власних копій несумісних DTO.

## Персональний беклог (без нових задач)

| Порядок | ID | Пріоритет | Назва | Залежності фінальної інтеграції (не старту) |
|---:|---|---|---|---|
| 1 | [FE3D-01](../../issues/FE3D-01.md) | **P0** | Створити преміальний 3D Lunar Terrain Viewer із плавним orbit/pan/zoom | ARC-01 |
| 2 | [FE3D-03](../../issues/FE3D-03.md) | **P0** | Реалізувати вибір точок A/B із raycast і коректними місячними координатами | FE3D-01, ARC-03, ARC-02 |
| 3 | [FE3D-02](../../issues/FE3D-02.md) | **P1** | Додати 3D tile loader, LOD, текстури й плавне підвантаження | FE3D-01, ARC-03 |
| 4 | [FE3D-04](../../issues/FE3D-04.md) | **P1** | Синхронізувати 3D-освітлення, Сонце й часовий scrub | FE3D-01, BE-05, FEUI-04 |
| 5 | [QA-02](../../issues/QA-02.md) | **P1** | Оптимізувати мобільний 3D, FPS, LOD та memory cleanup | FE3D-02, FEUI-01, OPS-02 |

Порядок — внутрішній орієнтир, а не міжлюдський блокуючий pipeline. Почни з P0; P1/P2 — після робочого основного сценарію. Відсутню суміжну реалізацію закривай typed adapter/stub **у своїй зоні** з integration pending. `HUM-*` із доступами, отриманням/ліцензуванням даних, secrets або submission потребують людини й дозволу.

## Frozen interfaces та передача

Надай `LunarTerrainViewer` із typed props/callbacks за `scene-types.ts`; UI підключиться після merge. Scene time надходить через props. Поки metadata не перевірені, mesh — DEMO, raycast не заявляє science-backed координат. Transform/CRS/vertical datum читай із валідованої metadata; графічні тіні не доводять видимість.

Не редагуй `contracts/**` у першій незалежній хвилі. Потребу зміни подай як `contract-change-request.md` у погодженій власній docs-зоні та запроси review impacted owners.

Спільні інваріанти: UTC із `Z`, latitude `[-90,-80]`, longitude `[-180,180]`, azimuth `[0,360)`, інтервали `[startUtc,endUtc)`, compare **B−A**. `visible:null` — unknown, `terrainApplied=false` — не підтверджена рельєфна видимість. Не видавай synthetic fixtures/mesh/світло за NASA; не замінюй unknown на нуль або success.

## Валідація свого результату

Ізольовані scene/transform тести, lat/lon roundtrip і lon wrap, click vs drag, resize/WebGL fallback, disposal, cancellation, scrub без запитів на кожен кадр. Для QA-02 додай фактичні device/browser/FPS/memory виміри, не обіцянку 60 FPS.

Для frontend-змін також виконай доступні `npm run build`, `npm test`, `npm run test:contracts` з `frontend/`. Якщо starter ще не має scripts/runtime/dependencies, наведи точну помилку та pending, а не вигаданий passed. Інструкції запуску Linux/Windows — у [README](../../README.md).

## Definition of handoff

- Посилання на існуючі task ID, результат і перелік змінених власних файлів.
- Точні фактично виконані команди, результати/логи; незапущені перевірки з причиною.
- Публічні експорти, props/providers/manifest, короткі кроки підключення і що лишилося integration pending.
- Джерела/quality/caveats, ризики, людські дії. Жодних secrets або великих DEM/GLB у Git.
- PR із незалежним review; оновлення через `git fetch origin` і `git merge origin/main`, без force push. Не commit/push/merge/deploy без явного доручення.

Ця сторінка — інструкція, **не звіт про завершення задач чи успішні перевірки**. Фінальні validation claims робляться лише батьківською інтеграцією за реальними результатами після з’єднання lane.
