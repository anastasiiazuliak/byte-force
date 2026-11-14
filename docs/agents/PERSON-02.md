# Людина №2 — UI Frontend

> Актуалізація parallel v2 на основі [готової персональної сторінки](../../people/PERSON-02.md). Список задач, їхні ID та пріоритети збережено. Історичні блокери старту скасовані [START_ALL_5](../../START_ALL_5.md): **починай одразу**, незалежно від готовності інших lane.

**Гілка:** `feature/lane-2`, власний clone від того самого погодженого commit `main`, що й решта команди. [Git workflow](../integration/team-workflow.md).

**Повний готовий prompt:** [PERSON-02-PASTE-INTO-CODEX](../../prompts/PERSON-02-PASTE-INTO-CODEX.md). Передай його агенту цілком; не запускай окремих агентів на кожен Issue в одному каталозі.

**З ким узгоджувати:** ARC-02 (DTO), FE3D-03 (site selection), INT-01/02 (API і інтеграція).

## Ownership

`frontend/src/features/{scenario-form,analysis,timeline,compare,methodology,export}/**`, `frontend/src/components/**`, `frontend/src/styles/**`, `frontend/src/app/**`. Не редагуй explorer, backend і frozen contracts.

Якщо старий Issue називає файл поза цією зоною, погодь зміну з власником. Не перенось межі самовільно. Спільну документацію змінюйте координовано.

## Прочитати до коду

[ТЗ](../TEAM_SPEC.md), [PARALLEL_CONTRACT](../../PARALLEL_CONTRACT.md), [OpenAPI](../../contracts/openapi.yaml), [DTO / LunarApiClient](../../contracts/api-types.ts), [scene types](../../contracts/scene/scene-types.ts), [transform](../../contracts/scene/TRANSFORM.md), свій prompt і всі свої Issues нижче. Frozen v2 перемагає старі ілюстративні JSON. Не створюй власних копій несумісних DTO.

## Персональний беклог (без нових задач)

| Порядок | ID | Пріоритет | Назва | Залежності фінальної інтеграції (не старту) |
|---:|---|---|---|---|
| 1 | [FEUI-01](../../issues/FEUI-01.md) | **P0** | Створити Lunar Mission Control UI shell та адаптивний дизайн | ARC-01 |
| 2 | [FEUI-02](../../issues/FEUI-02.md) | **P0** | Створити site picker та форму дати/часу з валідацією | FEUI-01, ARC-02 |
| 3 | [FEUI-03](../../issues/FEUI-03.md) | **P0** | Зробити Analysis Panel: картки, графіки, 360° horizon view | FEUI-01, ARC-02 |
| 4 | [FEUI-04](../../issues/FEUI-04.md) | **P0** | Створити Mission Timeline зі scrub, Play/Pause та синхронізацією часу | FEUI-03, ARC-02 |
| 5 | [FEUI-05](../../issues/FEUI-05.md) | **P0** | Створити Compare Mode для двох місць або різних дат | FEUI-03, FEUI-04, ARC-02 |
| 6 | [FEUI-06](../../issues/FEUI-06.md) | **P1** | Додати зрозумілі стани завантаження, пояснення точності та доступність | FEUI-02, FEUI-03, FEUI-05 |
| 7 | [P2-02](../../issues/P2-02.md) | **P2** | Додати експорт CSV і короткий звіт без підміни наукових даних | FEUI-05, DATA-05 |

Порядок — внутрішній орієнтир, а не міжлюдський блокуючий pipeline. Почни з P0; P1/P2 — після робочого основного сценарію. Відсутню суміжну реалізацію закривай typed adapter/stub **у своїй зоні** з integration pending. `HUM-*` із доступами, отриманням/ліцензуванням даних, secrets або submission потребують людини й дозволу.

## Frozen interfaces та передача

Використовуй frozen DTO і `LunarApiClient`, scene slot / `TerrainSceneProps` без імпорту ще не злитих internals №1. Єдине selectedTime UTC керує timeline/charts/scene. Клієнт №5 доступний через `frontend/src/integration/client`: `createApiClient`, `createConfiguredClient`. Frozen aliases `health/config/landingSites/mapMetadata` зберігаються; convenience `getHealth/getConfig/getLandingSites/getMapMetadata` із signal — additive API реалізації, не зміна контракту.

Не редагуй `contracts/**` у першій незалежній хвилі. Потребу зміни подай як `contract-change-request.md` у погодженій власній docs-зоні та запроси review impacted owners.

Спільні інваріанти: UTC із `Z`, latitude `[-90,-80]`, longitude `[-180,180]`, azimuth `[0,360)`, інтервали `[startUtc,endUtc)`, compare **B−A**. `visible:null` — unknown, `terrainApplied=false` — не підтверджена рельєфна видимість. Не видавай synthetic fixtures/mesh/світло за NASA; не замінюй unknown на нуль або success.

## Валідація свого результату

Форма coordinates/UTC/limits, null/partial/error rendering, `[start,end)` та 359→1, A=B і B−A, playback без зайвих fetch, desktop/mobile, keyboard/reduced-motion. Synthetic mock має явне маркування.

Для frontend-змін також виконай доступні `npm run build`, `npm test`, `npm run test:contracts` з `frontend/`. Якщо starter ще не має scripts/runtime/dependencies, наведи точну помилку та pending, а не вигаданий passed. Інструкції запуску Linux/Windows — у [README](../../README.md).

## Definition of handoff

- Посилання на існуючі task ID, результат і перелік змінених власних файлів.
- Точні фактично виконані команди, результати/логи; незапущені перевірки з причиною.
- Публічні експорти, props/providers/manifest, короткі кроки підключення і що лишилося integration pending.
- Джерела/quality/caveats, ризики, людські дії. Жодних secrets або великих DEM/GLB у Git.
- PR із незалежним review; оновлення через `git fetch origin` і `git merge origin/main`, без force push. Не commit/push/merge/deploy без явного доручення.

Ця сторінка — інструкція, **не звіт про завершення задач чи успішні перевірки**. Фінальні validation claims робляться лише батьківською інтеграцією за реальними результатами після з’єднання lane.
