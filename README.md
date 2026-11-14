# Lunar Navigator

Україномовний стартовий репозиторій Lunar Landing Site Navigator: порівняння двох сценаріїв посадки (місце + UTC-період) біля південного полюса Місяця, положення Сонця/Землі та локальний рельєфний горизонт.

> **Статус: initial bootstrap, не завершений застосунок і не перевірений NASA продукт.** Команди нижче — інструкції запуску, а не звіт про успішну валідацію. Реальні наукові обчислення, отримання й перевірка datasets, з’єднання lane, наскрізна перевірка та production deploy залишаються окремою роботою. Synthetic fixtures і демонстраційна геометрія не є вимірюваннями NASA.

## Спільний старт після architecture PR merge

Репозиторій: `git@github.com:anastasiiazuliak/byte-force.git`. Спочатку review/CI і merge architecture PR (`feature/bootstrap-architecture`) у `main`; лише після цього координатор фіксує **один повний SHA `origin/main`** для всіх п’ятьох незалежних clones/lane branches. Не стартуйте від старого окремого bootstrap `57f0aee`, незлитої architecture-гілки або різних HEAD. Далі всі lane працюють паралельно без очікування суміжних реалізацій. [Точні Git-кроки](docs/integration/team-workflow.md).

## Документація та пріоритети

- [ТЗ продукту](docs/TEAM_SPEC.md), [аудит контрактів та відкриті питання](docs/integration/contract-audit.md), [негайний старт усіх п’ятьох](START_ALL_5.md).
- [Заморожений паралельний контракт](PARALLEL_CONTRACT.md) — головний для полів і меж модулів першої хвилі; старі ілюстративні JSON у ТЗ його не перевизначають.
- [OpenAPI](contracts/openapi.yaml), [TypeScript DTO та LunarApiClient](contracts/api-types.ts), [scene types](contracts/scene/scene-types.ts), [координатний transform](contracts/scene/TRANSFORM.md).
- [Командний Git workflow](docs/integration/team-workflow.md), [розподіл завдань](TEAM_ASSIGNMENTS.md), [готові Issues](issues/).
- [Аудит наявного коду](docs/architecture/EXISTING_CODE_AUDIT.md), [Horizons внесок](docs/horizons.md), [HUM-02 джерела та audit caveat](docs/DATA_SOURCES.md#audit-caveat).
- [Збережений combined backlog](docs/Lunar_Navigator_TASK_BACKLOG.md), [tasks.json](tasks.json), [issues.csv](issues.csv), [архів і provenance dedup](docs/archive/package-reconciliation.md).

| Lane / гілка | Персональна інструкція | Повний prompt |
|---|---|---|
| 1 · 3D · `feature/lane-1` | [№1](docs/agents/PERSON-01.md) | [Prompt 1](prompts/PERSON-01-PASTE-INTO-CODEX.md) |
| 2 · UI · `feature/lane-2` | [№2](docs/agents/PERSON-02.md) | [Prompt 2](prompts/PERSON-02-PASTE-INTO-CODEX.md) |
| 3 · API · `feature/lane-3` | [№3](docs/agents/PERSON-03.md) | [Prompt 3](prompts/PERSON-03-PASTE-INTO-CODEX.md) |
| 4 · Data · `feature/lane-4` | [№4](docs/agents/PERSON-04.md) | [Prompt 4](prompts/PERSON-04-PASTE-INTO-CODEX.md) |
| 5 · Integration · `feature/lane-5` | [№5](docs/agents/PERSON-05.md) | [Prompt 5](prompts/PERSON-05-PASTE-INTO-CODEX.md) |

Усі п’ять починають одразу з одного стартового commit у незалежних clones. Залежності старих Issues означають залежності **фінальної інтеграції**, не заборону починати. P0 перед P1/P2; не створюйте нових задач замість готових беклогів.

## Структура

- `frontend/` — React + TypeScript + Vite, R3F/Three.js; UI і сцена мають окремих власників.
- `backend/LunarNavigator.sln` — **єдине активне .NET 8 solution**: API/Core/scaffold tests та збережені ByteForce.Horizons, Horizons tests і live sample. Старе root `.slnx` прибрано.
- `backend/ByteForce.Horizons/`, `backend/ByteForce.Horizons.Tests/`, `backend/samples/Horizons.Sample/` — попередній Horizons внесок; scientific `.cs` не переписано, project metadata retargeted на `net8.0`.
- `contracts/` — frozen API/scene контракти та fixtures; не дублюйте DTO.
- `people/`, `prompts/`, `issues/` — вихідні персональні беклоги й детальні завдання.
- `docs/agents/`, `docs/integration/` — актуальні інструкції роботи та передачі результатів.
- `data/README.md`, `data/scripts/download_data.py`, `data/scripts/download_data.ps1`, `data/raw/` — **збережені legacy HUM-02 шляхи**, не перенесені у `data-pipeline/`.
- `data-pipeline/`, `public-assets/`, `infra/` — зони подальших data/deploy реалізацій, не ознака їх готовності.

Фактичні результати локальних перевірок та незавершені GitHub-кроки: [bootstrap validation](docs/integration/bootstrap-validation.md). Приклади analyze/compare, typed errors і cache key: [API client guide](docs/integration/api-client.md). Для lane 3/4 готові provider interfaces описані у [backend README](backend/README.md).

## Передумови (Linux і Windows)

Git, Node.js **22** з npm та **.NET SDK 8** (див. `backend/global.json`). На Linux використовуйте shell, на Windows — PowerShell; Git Bash потрібен лише для `.sh`-скриптів. У Windows можна користуватися WSL, але не діліть `node_modules` між Windows і Linux. Перевірте `git --version`, `node --version`, `npm --version`, `dotnet --info`.

Отримайте URL репозиторію й погоджений стартовий SHA у команди; clone/branch інструкції наведено у workflow. Наступні команди виконуються з кореня локального clone і однакові для Linux shell та Windows PowerShell, якщо не зазначено інше.

## Frontend

```sh
cd frontend
npm install
npm run dev
```

Відкрийте локальний URL, який надрукує Vite. Dev-сервер працює до `Ctrl+C`; для інших команд відкрийте другий термінал.

### Явний mock-режим

Створіть або доповніть **`frontend/.env.local`**, не затираючи власні налаштування:

```dotenv
VITE_USE_MOCKS=true
```

Це явний opt-in для локальної розробки без API. Після зміни env перезапустіть Vite. UI має показувати **SYNTHETIC / DEMO**, включно з provenance/quality. Для реального API приберіть прапорець або встановіть `VITE_USE_MOCKS=false`; API локально запускається на `http://localhost:5080`, REST base — `/api/v1`. Vite proxy `/api` налаштований на цей backend; `frontend/.env.example` містить `VITE_API_BASE_URL` та server-only `API_PROXY_TARGET` для зміни адреси. Мінімальний starter entrypoint не викликає API та не є AppShell: №2 використовує клієнт у власному UI. Для standalone transport: `createApiClient({ transport: createMockTransport() })` з `src/api` та `src/mocks/transport`.

**Production: моки вимкнені незалежно від локального прапорця.** `VITE_USE_MOCKS=true` не повинен активувати synthetic transport у production build. Змінні `VITE_*` потрапляють до клієнтського коду: не кладіть туди секрети. API failure у real-режимі не можна приховано підміняти synthetic success.

### Build і тести

З каталогу `frontend/`:

```sh
npm run build
npm test
npm run test:contracts
```

Build створює production bundle, але не доводить наукову коректність. `test` перевіряє клієнт, mock isolation та контракти; `test:contracts` запускає лише контрактні перевірки. Lockfile включено; CI використовує `npm ci`. Окремий lint поки не налаштовано; build виконує strict TypeScript check.

## Backend

З кореня clone (Linux shell або Windows PowerShell):

```sh
cd backend
dotnet restore LunarNavigator.sln
dotnet build LunarNavigator.sln --configuration Release --no-restore
dotnet test LunarNavigator.sln --configuration Release --no-build
dotnet run --project LunarNavigator.Api --urls http://localhost:5080
```

API працює до `Ctrl+C`. Маршрут health за контрактом: `http://localhost:5080/api/v1/health`. Наявність solution або успішний health не означає готовності Horizons/LOLA/analyze. Без перевірених даних потрібні чесні unavailable/partial результати, а не вигадані фізичні значення.

### Збережений Horizons внесок і live opt-in

Horizons клієнт, observer validation, CSV/JSON parsing та HTTP-handler tests були внесені до architecture scaffold. Вони збережені, а не реалізовані заново; деталі й наукові обмеження — у [Horizons guide](docs/horizons.md). Тестовий набір містить **24 offline Horizons cases плюс 2 scaffold health cases**. Offline tests не звертаються до NASA; початковий restore потребує NuGet. Це опис набору, не новий звіт про успішний запуск — фактичні результати веде [parent validation](docs/integration/bootstrap-validation.md).

Із кореня clone, **лише з явним дозволом на живий мережевий запит**:

```sh
dotnet run --project backend/samples/Horizons.Sample
```

Sample викликає зовнішній NASA JPL Horizons; не є startup кроком, CI/offline test або доказом LOLA terrain visibility. API bootstrap ще не підключає його до analyze/compare. Клієнт не потребує API key.

## HUM-02 уже merged — не повторювати

**PR #4 уже merged:** contribution `c960326`, merge `92de0e8`. Збережено обидва acquisition scripts, `data/README.md`, raw placeholder та [DATA_SOURCES](docs/DATA_SOURCES.md). Architecture reconciliation не переробляє HUM-02, не завантажує DEM і не виправляє acquisition code.

Legacy команди, тільки після дозволу (обидві роблять мережеві запити; `--verify-only` — HEAD, не offline validation):

```sh
python data/scripts/download_data.py --verify-only
python data/scripts/download_data.py --download --dem-only
```

Windows PowerShell: `./data/scripts/download_data.ps1 -VerifyOnly` або `-Download -DemOnly`. Не комбінуйте verify-only і download flags. `LUNAR_DATA_DIR` / `LUNAR_DEM_PATH` описані в [data README](data/README.md), але їхні поточні edge cases залишаються предметом аудиту.

**Відкриті зауваження:** відсутні checksum/content checks, Python може прийняти коротку відповідь, PowerShell не гарантує failure exit code, env path semantics різняться; немає достатніх відтворюваних GDAL/CRS/datum, imagery alignment, point-source та two-person evidence. Історичний статус “complete” не засвідчує scientific readiness. Повний [audit caveat](docs/DATA_SOURCES.md#audit-caveat) доповнює, а не переписує оригінальні claims. Сирі дані не комітити.

## Опціональна публікація Issues

`tasks.json`, `issues.csv` та `publish_github_issues.py` збережено в корені; CSV `body_file` посилається на `issues/*.md`. Publisher за замовчуванням лише показує команди:

```sh
python publish_github_issues.py --repo anastasiiazuliak/byte-force --only BE-02
```

Не використовуйте `--apply` без людського дозволу та перевірки вже створених Issues: helper не deduplicate і не знає, що HUM-02 вже merged. GitHub assignees/permissions залишаються ручними. Історичні bootstrap/worktree scripts видалено з [provenance](docs/archive/package-reconciliation.md); створювати новий repository не потрібно.

## API-клієнт і frozen сумісність

Точка інтеграції frontend — **`src/integration/client`** (відносно `frontend/`), експорти `createApiClient` та `createConfiguredClient`. Перший створює клієнт явно, другий застосовує налаштування середовища, включно з dev-only opt-in mocks. Це інтеграційна межа lane №5; не створюйте паралельних HTTP-клієнтів у UI/сцені.

Заморожений `LunarApiClient` у `contracts/api-types.ts` зберігає методи `health()`, `config()`, `landingSites()`, `mapMetadata()`, `analyze(request)`, `compare(request)`, `ephemeris(request)`. Нові convenience-методи `getConfig`, `getLandingSites`, `getMapMetadata`, `getEphemeris` та підтримка `AbortSignal` належать розширенню/адаптеру клієнта, **не зміні frozen DTO чи обов’язкових сигнатур**. Старі aliases мають залишатися сумісними; нові споживачі можуть використовувати cancellable виклики. GET-методи приймають `signal?: AbortSignal` першим аргументом; POST-методи — другим після request. `createConfiguredClient()` асинхронний через lazy import mock transport. Приклад:

```ts
import { createConfiguredClient } from './integration/client'; // зі src
const api = await createConfiguredClient();
const controller = new AbortController();
const config = await api.getConfig(controller.signal);
// api.analyze(request, controller.signal)
```

`ApiClientError` з `src/api` має kind (`http`, `network`, `decode`), status і body; abort не маскується HTTP-помилкою. Клієнт типізований, але runtime JSON Schema validation виконується контрактними тестами, не кожним production request.

Контракт маршрутів: `GET /api/v1/{health,config,landing-sites,map/metadata}`, `POST /api/v1/{analyze,compare}` та optional `/api/v1/ephemeris`. Static terrain/tiles описані у PARALLEL_CONTRACT/metadata, але відсутні як окремі paths у frozen OpenAPI — див. аудит. Тільки health працює у bootstrap backend; інші маршрути реалізує №3. Mock ephemeris повертає чесний 503, не вигадані Moon-fixed напрямки.

## Наукова чесність і те, що ще попереду

- Latitude `[-90,-80]`, longitude `[-180,180]`, azimuth `[0,360)`; час — UTC ISO-8601 з `Z`, інтервали `[startUtc,endUtc)`, різниця compare — **B − A**.
- `visible:null` — невідомо, не `false` і не доступність; `terrainApplied=false` не є перевіркою видимості за рельєфом. Невідомі summaries не замінювати нулями.
- `elevationDeg` — астрономічна висота, `horizonDeg` — рельєфний горизонт, `clearanceDeg` — їх різниця. Графічні тіні ілюстративні, не науковий результат.
- Реальні CRS, vertical datum, bounds і scene transform встановлюються з metadata dataset, не з припущень. Потрібні справжні LOLA/LROC дані, перевірка джерел/ліцензій, Horizons і контрольні наукові точки.
- Великі DEM/GLB не комітити: публікувати через погоджене static storage. Credentials, hosting, NASA submission — людські дії з явним дозволом.
- Після merge lane ще потрібні wiring, реальний E2E, scientific validation і deploy. Цей README не засвідчує, що вони виконані.
