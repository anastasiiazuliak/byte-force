# ARC-02 — аудит замороженого v2

Джерело істини: `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, PARALLEL_CONTRACT v2. Оригінальні файли скопійовано без зміни полів. Виправлено лише неправильний re-export starter у `frontend/src/api/types.ts`.

## Підтверджені домовленості

- У OpenAPI є всі 7 API operations; `servers: /api/v1` + відносні paths утворюють погоджені адреси.
- JSON camelCase, місячна широта [-90,-80], довгота [-180,180]; азимут [0,360), градуси. Висоти — метри, не Earth mean sea level. DEM datum/CRS не вигадані.
- UTC ISO 8601 з Z; intervals [start,end), compare B−A. Unknown visibility, heights, summaries залишаються null.
- Scene x=easting−origin, y=height−verticalOrigin, z=−(northing−origin). Moon-fixed вектори не тотожні projected scene axes. Без validated metadata raycast не може обіцяти наукові координати.
- Обидва вихідні JSON fixtures валідні за схемами; partial fixture явно SYNTHETIC, жодних verified measurements. Map metadata містить null CRS/origins і metadataVerified=false.

## Відомі розбіжності / пропозиції на review (НЕ виправлено мовчки)

1. **AnalysisOptions:** OpenAPI не вимагає `terrainModel` / `includeHorizon`, DTO вимагає обидва, коли options присутній. У першій хвилі споживач або пропускає options, або передає обидва поля. `AnalysisRequest`/`CompareRequest` DTO assignable до schema, але зворотний напрям не гарантовано. Тест явно фіксує цю відому розбіжність, а не називає контракти повністю еквівалентними.
2. **Static assets:** `/terrain/{z}/{x}/{y}.glb` і `/tiles/{layer}/{z}/{x}/{y}.webp` погоджені у TEAM_SPEC/PARALLEL_CONTRACT, проте НЕ окремі OpenAPI paths. Це зовнішня статика, не API-контролери. Manifest/реальні файли готує lane 4; static server/deploy pending. Не додано фіктивних ресурсів або endpoint success.
3. **UTC:** `format: date-time` формально приймає offsets; вимога Z є в описі, не JSON Schema pattern. Перевірка UTC Z, end>start, sorted samples, maxSamples, IDs A/B унікальні, terrainApplied→visible consistency і unit vector length — семантичні обов'язки майбутніх validators, не забезпечені всіма frozen схемами.
4. **Error responses:** OpenAPI описує не всі HTTP errors із TEAM_SPEC (502/504/500 та частину compare errors). Клієнт приймає будь-який non-2xx, зберігає body/status; доповнення документації потребує погодження.
5. **ApiError.details:** schema `type: object` дозволяє довільні ключі, DTO Record<string,unknown> узгоджений із JSON Schema; генератор openapi-typescript без additionalProperties інтерпретує це як Record<string,never>. Для цього поля тест перевіряє runtime JSON Schema, а type equivalence перевіряє error без details. Це обмеження генерації, не причина змінювати frozen DTO.
6. Вимірювальні bounds/elevation ranges/positive resolutions не скрізь обмежені схемами. Точні CRS, datum, полярна конвенція азимуту та tile grid залишаються за ARC-03; інфраструктура їх не підміняє.

## Автоматична перевірка

`cd frontend && npm run test:contracts`: OpenAPI parser, AJV JSON Schema 2020-12 для fixtures та всіх mock success/error форм, негативні schema checks, тимчасова генерація типів і двостороння structural assignability основних DTO. Генеровані типи існують лише в OS temp і видаляються; другої копії контрактів у репозиторії немає. Known exceptions вище явно закодовані. Це не перевірка реального NASA API або майбутнього backend.

## Спільна .NET межа, доступна вже у bootstrap

`backend/LunarNavigator.Core/Analysis/TerrainProviders.cs`: ITerrainHeightProvider, IHorizonProfileProvider, records та cancellation. Lane 4 реалізує їх у Terrain/Horizon, lane 3 споживає. Поточні default adapters повертають unavailable, не flat horizon/вигадані висоти. Цю стартову внутрішню межу також не редагують незалежно без review.
