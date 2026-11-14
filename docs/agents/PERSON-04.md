# Людина №4 — LOLA / Data

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  HUM-02 is already merged in PR #4 (`c960326`, merge `92de0e8`); preserve legacy `data/**`, do not redo it. Integrity/provenance review remains outstanding.  See [current workflow](../integration/team-workflow.md) and [data caveat](../DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

> Актуалізація parallel v2 на основі [готової персональної сторінки](../../people/PERSON-04.md). Список задач, їхні ID та пріоритети збережено. Історичні блокери старту скасовані [START_ALL_5](../../START_ALL_5.md): **починай одразу**, незалежно від готовності інших lane.

**Гілка:** `feature/lane-4`, власний clone від того самого погодженого commit `main`, що й решта команди. [Git workflow](../integration/team-workflow.md).

**Повний готовий prompt:** [PERSON-04-PASTE-INTO-CODEX](../../prompts/PERSON-04-PASTE-INTO-CODEX.md). Передай його агенту цілком; не запускай окремих агентів на кожен Issue в одному каталозі.

**З ким узгоджувати:** ARC-02 (API і система координат), FE3D-01 (меш), BE-03 (горизонт), BE-06 (metadata).

## Ownership

`data-pipeline/**`, `public-assets/**`, `backend/LunarNavigator.Core/{Terrain,Horizon}/**`, `backend/LunarNavigator.Tests/Terrain/**`, `docs/science/**`. Не редагуй API controllers/Program.cs, frontend і frozen contracts.

Якщо старий Issue називає файл поза цією зоною, погодь зміну з власником. Не перенось межі самовільно. Спільну документацію змінюйте координовано.

## Прочитати до коду

[ТЗ](../TEAM_SPEC.md), [PARALLEL_CONTRACT](../../PARALLEL_CONTRACT.md), [OpenAPI](../../contracts/openapi.yaml), [DTO / LunarApiClient](../../contracts/api-types.ts), [scene types](../../contracts/scene/scene-types.ts), [transform](../../contracts/scene/TRANSFORM.md), свій prompt і всі свої Issues нижче. Frozen v2 перемагає старі ілюстративні JSON. Не створюй власних копій несумісних DTO.

## Персональний беклог (без нових задач)

| Порядок | ID | Пріоритет | Назва | Залежності фінальної інтеграції (не старту) |
|---:|---|---|---|---|
| 1 | [HUM-02](../../issues/HUM-02.md) | **P0** | Отримати й перевірити офіційні NASA-дані для DEM та зображень | немає |
| 2 | [ARC-03](../../issues/ARC-03.md) | **P0** | Затвердити місячні координати, висотну базу, scene-transform і tile grid | ARC-02, HUM-02 |
| 3 | [DATA-01](../../issues/DATA-01.md) | **P0** | Підключити NASA LOLA GeoTIFF через GDAL і читати висоту за координатами | HUM-02, ARC-03 |
| 4 | [DATA-03](../../issues/DATA-03.md) | **P0** | Зробити offline DEM → один реальний 3D mesh GLB для demo-ділянки | HUM-02, ARC-03 |
| 5 | [DATA-02](../../issues/DATA-02.md) | **P0** | Обчислити 360° локальний горизонт із LOLA та кривизною Місяця | DATA-01, ARC-03 |
| 6 | [DATA-05](../../issues/DATA-05.md) | **P0** | Перевірити геометрію, горизонти та вихідні дані NASA на контрольних точках | DATA-02, BE-02 |
| 7 | [DATA-04](../../issues/DATA-04.md) | **P1** | Побудувати LOD GLB/WebP тайли і заповнити map metadata | DATA-03, ARC-03 |
| 8 | [P2-01](../../issues/P2-01.md) | **P2** | Додати наукову raster-маску освітленості цілої ділянки | BE-05, DATA-04, DATA-05 |
| 9 | [P2-03](../../issues/P2-03.md) | **P2** | Додати 5 м/піксель DEM для вибраної високодетальної зони | DATA-04, DATA-05 |

Порядок — внутрішній орієнтир, а не міжлюдський блокуючий pipeline. Почни з P0; P1/P2 — після робочого основного сценарію. Відсутню суміжну реалізацію закривай typed adapter/stub **у своїй зоні** з integration pending. `HUM-*` із доступами, отриманням/ліцензуванням даних, secrets або submission потребують людини й дозволу.

## Frozen interfaces та передача

Надай Terrain/Horizon providers у власному namespace та extension method / інструкцію wiring, не редагуючи Program.cs №3. Публікуй terrain asset manifest після перевірки реального DEM metadata. Узгодь scene transform із №1 і API із №3/№5. Якщо dataset ще немає — маленькі явно synthetic raster fixtures для pipelines, не вигадані CRS/datum NASA.

Не редагуй `contracts/**` у першій незалежній хвилі. Потребу зміни подай як `contract-change-request.md` у погодженій власній docs-зоні та запроси review impacted owners.

Спільні інваріанти: UTC із `Z`, latitude `[-90,-80]`, longitude `[-180,180]`, azimuth `[0,360)`, інтервали `[startUtc,endUtc)`, compare **B−A**. `visible:null` — unknown, `terrainApplied=false` — не підтверджена рельєфна видимість. Не видавай synthetic fixtures/mesh/світло за NASA; не замінюй unknown на нуль або success.

## Валідація свого результату

Тести GeoTIFF read/transform, coverage/nodata, горизонту й кривизни на контрольних входах; перевірка manifest, GLB/LOD і metadata. Відокремлюй synthetic unit fixtures від реальних контрольних NASA-точок DATA-05. Документуй джерела/ліцензії, resolution, CRS та vertical reference. Конкретні pipeline-команди бери з реалізованого інструмента, не вигадуй.

Для frontend-змін також виконай доступні `npm run build`, `npm test`, `npm run test:contracts` з `frontend/`. Якщо starter ще не має scripts/runtime/dependencies, наведи точну помилку та pending, а не вигаданий passed. Інструкції запуску Linux/Windows — у [README](../../README.md).

## Definition of handoff

- Посилання на існуючі task ID, результат і перелік змінених власних файлів.
- Точні фактично виконані команди, результати/логи; незапущені перевірки з причиною.
- Публічні експорти, props/providers/manifest, короткі кроки підключення і що лишилося integration pending.
- Джерела/quality/caveats, ризики, людські дії. Жодних secrets або великих DEM/GLB у Git.
- PR із незалежним review; оновлення через `git fetch origin` і `git merge origin/main`, без force push. Не commit/push/merge/deploy без явного доручення.

Ця сторінка — інструкція, **не звіт про завершення задач чи успішні перевірки**. Фінальні validation claims робляться лише батьківською інтеграцією за реальними результатами після з’єднання lane.
