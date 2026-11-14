# Командний workflow: п’ять незалежних lane

## Джерела та межі

Прочитайте [PARALLEL_CONTRACT](../../PARALLEL_CONTRACT.md), [START_ALL_5](../../START_ALL_5.md), [ТЗ](../TEAM_SPEC.md) і [персональні інструкції](../agents/). Готові `people/`, `prompts/`, `issues/` не потребують повторного винайдення задач. Історичне «чекати ARC-01/02/03» скасовано для старту правилом v2; інтеграційні залежності залишаються.

Кожен працює у **власному clone**, на власній гілці `feature/lane-1` … `feature/lane-5`. Не запускайте п’ять агентів у спільному робочому каталозі. Worktree допустимий як усвідомлена альтернатива, але не потрібен для цього workflow.

## Одноразова підготовка людиною

1. Спочатку завершити review/CI та merge architecture PR (`feature/bootstrap-architecture`) у `main`. Лише після merge погодити **один повний стартовий SHA `origin/main`** для всіх п’ятьох. Не використовувати історичний bootstrap `57f0aee` або незлиту architecture-гілку. Репозиторій уже існує: `git@github.com:anastasiiazuliak/byte-force.git`. Ця інструкція не виконує commit/push автоматично.
2. Адміністратору налаштувати protection/ruleset `main`: тільки PR, щонайменше **одне схвалення іншого учасника**, обов’язкові CI jobs **`frontend`, `backend` і `repository`**, заборона force push і видалення гілки. Назви checks вибрати за фактично зареєстрованими результатами GitHub Actions; після зміни назв jobs оновити ruleset. YAML workflow сам по собі branch protection не вмикає.
3. Не обходити CI адміністративним merge. За потреби вимагати resolved conversations та актуальність PR щодо `main`. Доступи й secrets налаштовує людина, не агент.

## Клонування та спільна база

Нижче `START_SHA` замініть на один погоджений повний SHA після merge architecture PR; `N` — свій номер 1–5. Спочатку координатор і всі учасники перевіряють, що PR справді merged. Команди не запускаються автоматично.

```sh
git clone git@github.com:anastasiiazuliak/byte-force.git lunar-lane-N
cd lunar-lane-N
git fetch origin
git rev-parse origin/main
```

Поки `origin/main` ще відповідає стартовому SHA, створіть свою гілку:

```sh
git switch -c feature/lane-N START_SHA
git rev-parse HEAD
```

Усі п’ять мають отримати однаковий `HEAD` перед першими власними змінами. Якщо `main` уже просунувся, погоджений START_SHA усе одно є спільною базою; не підмінюйте його різними поточними HEAD.

Старі пакетні bootstrap/worktree scripts видалені як історичні; не створюйте
новий репозиторій і не використовуйте локальні старі lane refs як доказ спільної бази.
Якщо `feature/lane-N` уже існує, перевірте її SHA з координатором; не пересувайте й не
перезаписуйте чужу гілку. Публікація lane branches потребує окремого дозволу людини.

## Уже інтегровані внески

Horizons збережено в `backend/LunarNavigator.Horizons/`; 24 offline cases не перевіряють
живий NASA сервіс. Використовуйте [готову бібліотеку](../horizons.md), а не новий клієнт.
HUM-02 merged PR #4 (`c960326`, merge `92de0e8`): legacy `data/**` збережено,
[зауваження аудиту](../DATA_SOURCES.md#audit-caveat) відкриті. Не повторюйте придбання
даних/мережеві перевірки без явної згоди. Історичні tasks/unchecked boxes не означають,
що код відсутній або що наукова валідація завершена.

## Ownership першої хвилі

| Lane | Пише лише у свою зону |
|---|---|
| 1 | `frontend/src/features/explorer/**`, `docs/3d/**` |
| 2 | `frontend/src/features/{scenario-form,analysis,timeline,compare,methodology,export}/**`, `frontend/src/{components,styles,app}/**` |
| 3 | `backend/LunarNavigator.Api/**`, `backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/**`, `backend/tests/LunarNavigator.Api.Tests/**` |
| 4 | `data-pipeline/**`, `public-assets/**`, `backend/LunarNavigator.Core/{Terrain,Horizon}/**`, `backend/tests/LunarNavigator.Core.Tests/Terrain/**`, `docs/science/**` |
| 5 | `frontend/src/{api,mocks,integration}/**`, `frontend/e2e/**`, `infra/**`, `.github/**`, `scripts/**`, `docs/integration/**` |

README і `docs/agents/**` — координована документація; не редагувати одночасно з іншими авторами. Якщо старий Issue пропонує файл поза актуальною ownership-матрицею, погодьте передачу з власником, не розширюйте свою зону самовільно. Особливо: №4 не править `Program.cs`, №5 не переписує app shell №2, №1 не імпортує UI internals.

## Frozen межі

`contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*` та canonical fixtures не переписувати у незалежних гілках першої хвилі. Пропозицію зміни оформіть у власній docs-зоні як `contract-change-request.md` із причиною, сумісністю, impacted consumers і планом тестів. Реальна зміна — тільки після командного review.

- №1 надає `LunarTerrainViewer` і typed scene callbacks/props; metadata/transform читає динамічно.
- №2 працює з frozen DTO й `LunarApiClient`; до merge використовує scene slot і явно позначені mocks.
- №3 споживає готові `ITerrainHeightProvider` / `IHorizonProfileProvider` у `Core/Analysis/TerrainProviders.cs`; №4 реалізує їх без редагування сигнатур. Unavailable adapters не вигадують visibility.
- №4 надає providers/manifest у своїй зоні. №3/№5 погоджують остаточне підключення після merge.
- №5 надає `createApiClient`, `createConfiguredClient` через `frontend/src/integration/client`, mocks і contract tests. Frozen `health/config/landingSites/mapMetadata` залишаються; `getConfig/getLandingSites/getMapMetadata/getEphemeris` і cancellable виклики з signal — additive convenience API, не переписування контракту.

## Оновлення гілки без переписування історії

Перед оновленням перевірте `git status`: робочі зміни мають бути безпечно збережені. У своїй lane-гілці:

```sh
git fetch origin
git merge origin/main
```

Вирішуйте конфлікти разом із власником відповідної зони; не використовуйте глобальне «ours/theirs» для чужого коду. Повторіть релевантні тести. Не робіть rebase опублікованих гілок, `reset --hard` чужої роботи чи **force push**. Push своєї гілки та створення PR — лише з дозволом людини; агент не виконує їх автоматично.

## PR, CI та передача

Використайте [шаблон PR](../../.github/PULL_REQUEST_TEMPLATE.md): task ID, власні файли, незмінність contracts, mock/real mode, точні команди та фактичні результати, ризики й integration pending. Скриншоти/метрики додавати з контекстом, не вигадувати. Не ставте «passed», якщо команда не запускалася; позначайте «не запускалось» із причиною.

Цільові checks із кореня відповідного модуля:

- `frontend/`: `npm install`, `npm run build`, `npm test`, `npm run test:contracts` (CI встановлює залежності через `npm ci` після появи lockfile).
- `backend/`: `dotnet restore LunarNavigator.sln`, `dotnet build LunarNavigator.sln --configuration Release --no-restore`, `dotnet test LunarNavigator.sln --configuration Release --no-build`.

Test scripts і lockfile вже включені. Локальні результати bootstrap: [validation report](bootstrap-validation.md). GitHub CI ще потрібно виконати після публікації; YAML сам по собі не доводить успішного запуску. Не обходьте required checks.

Для публікації власної роботи після дозволу:

```sh
git status
git add ШЛЯХИ_ВЛАСНОГО_МОДУЛЯ
git commit -m "TASK-ID: short description"
git push -u origin feature/lane-N
```

У GitHub натисніть **Compare & pull request** або **Pull requests → New pull request**: base `main`, compare `feature/lane-N`. Заповніть шаблон, зазначте task IDs, додайте reviewer іншого учасника й дочекайтеся CI. Не зливайте PR самостійно без узгодження. Позначення шляхів/N замініть своїми значеннями.

Після одного незалежного review та required CI інтегратор з дозволом людини зливає lane по одному. Після merge: коротке wiring, E2E вибір → період → analyze → compare, перевірка null/partial/error, mocks off у production, реальні datasets/CRS/наукові контрольні точки. Деплой і NASA submission не завершуються автоматично разом із bootstrap. `HUM-*`, credentials, ліцензії та hosting залишаються людськими діями.
