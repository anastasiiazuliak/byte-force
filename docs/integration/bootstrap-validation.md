# Validation: team architecture reconciliation

Дата: 2026-11-14. Усі application перевірки нижче виконані саме в `.audit/integration/`, а не в локальному bootstrap. База аудиту `92de0e85620df512fdd7ce199126ed6c5d5b43ca`; architecture branch `feature/bootstrap-architecture`.

## Фактично виконано

| Перевірка | Результат |
|---|---|
| `frontend: npm ci` | Успішно, lockfile відтворюється |
| `npm run build` | Strict TypeScript + Vite production bundle успішні |
| `npm test` | 12/12: 7 client/mock/cache cases + 5 contracts |
| `npm run test:contracts` | 5/5, повторний цільовий запуск |
| `npm audit` | 0 vulnerabilities |
| `dotnet restore backend/LunarNavigator.sln` | Успішно, фінальний restore без відключення NuGet audit |
| `dotnet build backend/LunarNavigator.sln --configuration Release --no-restore --disable-build-servers` | 0 warnings, 0 errors, усі 6 projects на net8.0 |
| `dotnet test backend/LunarNavigator.sln --configuration Release --no-build --no-restore` | 26/26: існуючі 24 Horizons + 2 scaffold, жодних skipped |
| `dotnet list ABSOLUTE_SOLUTION_PATH package --vulnerable --include-transitive` | NuGet.org: жодних відомих вразливих пакетів у всіх 6 projects |
| HTTP smoke із реальними dev processes | Frontend `/` 200; backend `/api/v1/health` 200; Vite proxy health 200 |
| Неіснуючий science endpoint | GET `/api/v1/analyze` 404, немає фіктивної реалізації |
| Source preservation | Усі 11 оригінальних Horizons/sample/test `.cs` byte-identical до team base |
| HUM-02 preservation | Scripts, data README, raw placeholder та LICENSE byte-identical до team base |
| Frozen contracts | Усі 6 файлів byte-identical до вихідного team package і локального bootstrap |
| Documentation reconciliation | 37 CSV/JSON task IDs і publisher body paths узгоджені; локальні README/agent/workflow links перевірені |
| Static checks | Python downloader AST parse, shell script syntax, staged diff whitespace та tracked-file guard пройшли |

SDK 8.0.132 / runtime 8.0.32, Node 22.22.2. .NET homes/cache і npm cache розміщені у локальній ignored `.validation/`. Dev smoke використовував порти 5087/5187 із custom proxy target; процеси зупинені. Окремого frontend lint немає — strict typecheck входить до build.

Перший `dotnet list backend/LunarNavigator.sln package ...` натрапив на MSBuild path-resolution error цієї SDK. Повторний виклик із повним абсолютним шляхом до solution успішний; не змінювали код, щоб приховати tooling error.

## Чого не перевіряли / що не завершено

- GitHub Actions run і branch protection: потребують опублікованої гілки/PR та налаштувань власника; локальні команди не є доказом green GitHub run.
- Live NASA sample, DEM downloads/HEAD checks, GDAL/LOLA computations, незалежна наукова точність — не запускались.
- PowerShell відсутній у середовищі; downloader `.ps1` лише статично проаналізовано. Ручна команда за потреби: `pwsh -File data/scripts/download_data.ps1 -VerifyOnly` (робить мережевий HEAD; наявні caveats exit status див. аудит).
- Browser/WebGL/UI E2E, реальні analyze/compare/ephemeris, deployment — ще не реалізовані іншими lane, не позначаються готовими.
- Pattern-based secret guard пройшов, але не гарантує виявлення будь-якого секрету. Потрібні review та GitHub secret scanning/push protection за доступності.

## Task status без завищення готовності

- **ARC-01:** compile-ready монорепозиторій/SDK/proxy/health foundation реалізовано та перевірено, існуючий Horizons reusable.
- **ARC-02:** canonical contracts і автоматичні validators готові; documented schema/TS exceptions залишаються на review, несумісних правок немає.
- **INT-01:** typed client, cancellation, errors, mock transport, cache key, contract tests готові.
- **OPS-01:** CI YAML + відповідні локальні перевірки готові; remote run/protection ще потребують підтвердження.
- **HUM-01:** Git/PR/ownership документація готова; permissions/rulesets — власник GitHub.
- **HUM-02:** уже merged PR #4 до цієї роботи; не повторюється й повторно не закривається. Downloader integrity/provenance findings передані lane 4 у [аудиті](../architecture/EXISTING_CODE_AUDIT.md).
- **BE-02 та інші science/UI/data tasks:** не закриті цією architecture роботою. Наявна single-instant Horizons library не дорівнює завершеному period/terrain analysis service.

## Старт команди

Після review/CI та merge architecture PR усі п'ять clones беруть один погоджений повний SHA `origin/main`. Не використовувати окремий локальний bootstrap commit `57f0aee`. Інструкції/готові prompts — у README. .NET Terrain/Horizon interfaces вже існують; low-level Horizons доступний Core через ProjectReference, але не wired у API science endpoints. Synthetic mocks дозволяють незалежний frontend старт без backend або DEM.
