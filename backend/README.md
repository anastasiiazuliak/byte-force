# Lunar Navigator backend (.NET 10)

Один solution: `backend/LunarNavigator.sln`. Назва проєкту, assembly, папки та базового namespace
збігається; усі вони починаються з `LunarNavigator`.

```text
backend/
  LunarNavigator.Api/                 HTTP endpoints, config, catalog, public DTOs
  LunarNavigator.Core/                Analysis, terrain/horizon interfaces and unavailable providers
  LunarNavigator.Horizons/            NASA JPL Horizons HTTP client
  LunarNavigator.Models/              Shared lunar observer/observation models
  tests/
    LunarNavigator.Api.Tests/         HTTP, CORS, catalog and provider DI tests
    LunarNavigator.Core.Tests/        Coordinate control points and data-lane tests
    LunarNavigator.Horizons.Tests/    Horizons requests, responses and cancellation
    LunarNavigator.Models.Tests/      Model validation
  samples/
    LunarNavigator.Horizons.Sample/   Explicit live NASA request
  LunarNavigator.sln
  global.json
```

## Запуск із кореня репозиторію

```sh
dotnet restore backend/LunarNavigator.sln
dotnet build backend/LunarNavigator.sln --no-restore
dotnet test backend/LunarNavigator.sln --no-build
dotnet run --project backend/LunarNavigator.Api --urls http://localhost:5080
```

Для одного модуля:

```sh
dotnet test backend/tests/LunarNavigator.Api.Tests
dotnet test backend/tests/LunarNavigator.Core.Tests
dotnet test backend/tests/LunarNavigator.Horizons.Tests
dotnet test backend/tests/LunarNavigator.Models.Tests
```

Потрібен .NET 10 SDK; root і backend `global.json` вибирають `8.0.100` з `latestFeature`.
Усі проєкти мають target `net10.0`. У solution тести зібрані в окремій папці `tests`.

BE-01 реалізує health, config і landing-sites; деталі — у [README API](LunarNavigator.Api/README.md).
Каталог містить явно позначені DEMO-точки. Health перевіряє тільки вебсервер.
Horizons клієнт ще не підключений до analyze/compare. Наукові алгоритми під час перейменування не змінювалися.

## Terrain / Horizon handoff

`LunarNavigator.Core.Analysis.ITerrainHeightProvider` і `IHorizonProfileProvider` приймають координати
та CancellationToken. Типи лишаються в `LunarNavigator.Core/Analysis/TerrainProviders.cs`.
Реалізації слід додавати в `LunarNavigator.Core/Terrain/` і `Horizon/`, тести — у
`tests/LunarNavigator.Core.Tests/Terrain/`. Контракт HTTP не змінювався.

API реєструє unavailable-провайдери через TryAddSingleton: unknown elevation — null, профіль порожній,
terrainApplied/datumVerified — false, з попередженнями. Реальні дані мають пройти перевірку датуму й покриття.
Тест реєстрації провайдерів у DI залишається в Api.Tests, окремо від перевірок їхньої геометрії.

Coordinate fixture копіюється з `contracts/fixtures/coordinate-control-points.json` до вихідної
папки Core.Tests; тест не залежить від кількості батьківських папок. Тести не звертаються до NASA.

## Live sample

Лише після явного дозволу на живий зовнішній запит:

```sh
dotnet run --project backend/samples/LunarNavigator.Horizons.Sample
```

Наукові обмеження клієнта — у [Horizons guide](../docs/horizons.md).
