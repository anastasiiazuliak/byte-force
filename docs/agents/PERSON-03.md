# Людина №3 — Backend / Horizons

> Актуалізація parallel v2 на основі [готової персональної сторінки](../../people/PERSON-03.md). Список задач, їхні ID та пріоритети збережено. Історичні блокери старту скасовані [START_ALL_5](../../START_ALL_5.md): **починай одразу**, незалежно від готовності інших lane.

**Гілка:** `feature/lane-3`, власний clone від того самого погодженого commit `main`, що й решта команди. [Git workflow](../integration/team-workflow.md).

**Повний готовий prompt:** [PERSON-03-PASTE-INTO-CODEX](../../prompts/PERSON-03-PASTE-INTO-CODEX.md). Передай його агенту цілком; не запускай окремих агентів на кожен Issue в одному каталозі.

**З ким узгоджувати:** ARC-02 (OpenAPI), DATA-02 (горизонт), DATA-03 (metadata тайлів), BE-05 узгодити з 3D.

## Ownership

`backend/LunarNavigator.Api/**`, `backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/**`, `backend/LunarNavigator.Tests/Api/**`. Не редагуй Terrain/Horizon, frontend і frozen contracts.

Якщо старий Issue називає файл поза цією зоною, погодь зміну з власником. Не перенось межі самовільно. Спільну документацію змінюйте координовано.

## Прочитати до коду

[ТЗ](../TEAM_SPEC.md), [PARALLEL_CONTRACT](../../PARALLEL_CONTRACT.md), [OpenAPI](../../contracts/openapi.yaml), [DTO / LunarApiClient](../../contracts/api-types.ts), [scene types](../../contracts/scene/scene-types.ts), [transform](../../contracts/scene/TRANSFORM.md), свій prompt і всі свої Issues нижче. Frozen v2 перемагає старі ілюстративні JSON. Не створюй власних копій несумісних DTO.

## Персональний беклог (без нових задач)

| Порядок | ID | Пріоритет | Назва | Залежності фінальної інтеграції (не старту) |
|---:|---|---|---|---|
| 1 | [BE-01](../../issues/BE-01.md) | **P0** | Реалізувати .NET API foundation, config та каталог місць | ARC-01, ARC-02 |
| 2 | [BE-02](../../issues/BE-02.md) | **P0** | Підключити JPL Horizons: локальні азимут/висота Сонця та Землі | ARC-02 |
| 3 | [BE-06](../../issues/BE-06.md) | **P0** | Реалізувати GET /map/metadata для синхронізації 3D mesh, CRS та static URLs | ARC-02, ARC-03, DATA-03 |
| 4 | [BE-03](../../issues/BE-03.md) | **P0** | Реалізувати POST /analyze: горизонти, видимість, інтервали, summaries | BE-02, DATA-02, ARC-02 |
| 5 | [BE-04](../../issues/BE-04.md) | **P0** | Реалізувати POST /compare та узгоджені метрики A/B | BE-03, ARC-02 |
| 6 | [BE-05](../../issues/BE-05.md) | **P1** | POST /ephemeris: перевірені Moon-fixed напрями для освітлення 3D | BE-02, ARC-03 |

Порядок — внутрішній орієнтир, а не міжлюдський блокуючий pipeline. Почни з P0; P1/P2 — після робочого основного сценарію. Відсутню суміжну реалізацію закривай typed adapter/stub **у своїй зоні** з integration pending. `HUM-*` із доступами, отриманням/ліцензуванням даних, secrets або submission потребують людини й дозволу.

## Frozen interfaces та передача

Визнач `ITerrainHeightProvider` і `IHorizonProfileProvider` у власному Core Analysis. Без №4 використовуй unavailable adapters із чесним partial/null або контрактною помилкою. Реалізації Terrain/Horizon підключаються після merge; metadata manifest до перевірки не має `metadataVerified=true`. Не підміняй Horizons вигаданими вимірюваннями.

Не редагуй `contracts/**` у першій незалежній хвилі. Потребу зміни подай як `contract-change-request.md` у погодженій власній docs-зоні та запроси review impacted owners.

Спільні інваріанти: UTC із `Z`, latitude `[-90,-80]`, longitude `[-180,180]`, azimuth `[0,360)`, інтервали `[startUtc,endUtc)`, compare **B−A**. `visible:null` — unknown, `terrainApplied=false` — не підтверджена рельєфна видимість. Не видавай synthetic fixtures/mesh/світло за NASA; не замінюй unknown на нуль або success.

## Валідація свого результату

З `backend/`: `dotnet restore LunarNavigator.sln`, `dotnet build LunarNavigator.sln --configuration Release --no-restore`, `dotnet test LunarNavigator.sln --configuration Release --no-build`. Додай targeted API/parser/calculation тести, validation errors, unavailable terrain/ephemeris, partial/null і compare B−A. Для локального запуску: `dotnet run --project LunarNavigator.Api --urls http://localhost:5080`.

Для frontend-змін також виконай доступні `npm run build`, `npm test`, `npm run test:contracts` з `frontend/`. Якщо starter ще не має scripts/runtime/dependencies, наведи точну помилку та pending, а не вигаданий passed. Інструкції запуску Linux/Windows — у [README](../../README.md).

## Definition of handoff

- Посилання на існуючі task ID, результат і перелік змінених власних файлів.
- Точні фактично виконані команди, результати/логи; незапущені перевірки з причиною.
- Публічні експорти, props/providers/manifest, короткі кроки підключення і що лишилося integration pending.
- Джерела/quality/caveats, ризики, людські дії. Жодних secrets або великих DEM/GLB у Git.
- PR із незалежним review; оновлення через `git fetch origin` і `git merge origin/main`, без force push. Не commit/push/merge/deploy без явного доручення.

Ця сторінка — інструкція, **не звіт про завершення задач чи успішні перевірки**. Фінальні validation claims робляться лише батьківською інтеграцією за реальними результатами після з’єднання lane.
