# PR: узгоджена основа Lunar Navigator для паралельної розробки

Base: `main` · Head: `feature/bootstrap-architecture`

## Що змінено

- Проведено read-only аудит team main та origin/docs/HUM-02 branches; обидві вже повністю merged. [Повний аудит](../architecture/EXISTING_CODE_AUDIT.md).
- Збережено існуючі Horizons request/parser/observer/sample/test `.cs` побайтно. Проєкти перенесено до backend, metadata retargeted із .NET10 до погодженого .NET8; усі 24 існуючі offline tests проходять. Core має project reference, без science wiring.
- HUM-02 PR #4 НЕ реалізовано повторно: downloader code/data залишено без змін; portability docs links виправлено, caveats integrity/provenance явно задокументовано.
- Активовано один canonical contracts/spec/issues/prompts layout замість вкладеного starter package; зайві дублікати прибрано з provenance у docs/archive.
- Вибірково додано відсутні React/TS/Vite entrypoint, typed cancellable API client, isolated DEV-only mock selection, OpenAPI/fixture/type tests, .NET health/Core/provider interfaces, CI та repository guards.
- Додано README, п'ять персональних інструкцій і готові prompts. Спільний старт — після merge цього PR з одного погодженого main SHA.

## Перевірки

- Frontend `npm ci`, build, 12 tests; повторний contract subset 5/5; npm audit 0.
- .NET8 restore/Release build: 0 warnings/errors, 26 offline tests (24 preserved + 2 scaffold).
- NuGet vulnerable/transitive report: no known vulnerable packages.
- Реальні frontend/health/proxy HTTP smoke — 200, dev processes stopped.
- Source/contract/HUM-02 byte-preservation, docs links/task metadata, whitespace та secret/large-file guard пройшли.
- [Детальний validation report](bootstrap-validation.md).

## Важливе для reviewer

- Frozen API/scene поля НЕ змінено. Відомі schema/TypeScript discrepancies — [окремий audit](contract-audit.md).
- API має тільки health; реальний analyze/compare/ephemeris, terrain science, 3D/UI і deploy НЕ реалізовані цим PR.
- Existing Horizons apparent local angles — НЕ verified terrain visibility / Moon-fixed vectors.
- Live NASA/GDAL/DEM downloads не запускались. HUM-02 defects не приховані й передані lane 4.
- Немає unrelated-history merge, force push або raw NASA datasets.

## Task scope

ARC-01, ARC-02 audit/validators, INT-01 та OPS-01 configuration. HUM-01 settings і remote CI status потребують owner/reviewer. HUM-02 вже merged; BE/FE/DATA implementations не закриваємо.

## Після merge

1. Координатор повідомляє один повний main SHA; усі учасники створюють feature/lane-N зі спільної бази за README.
2. Власник вмикає required frontend/backend/repository checks, незалежний review, no-force-push protection.
3. Lane 3 повторно використовує backend/ByteForce.Horizons; lane 4 виправляє documented data integrity/provenance findings у своїй роботі. Contracts змінюються лише окремим погодженим review.

Автоматичний merge не дозволений і не виконується.
