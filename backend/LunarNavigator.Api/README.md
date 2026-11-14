# LunarNavigator.Api — BE-01

ASP.NET Core API на .NET 8 у спільному `backend/LunarNavigator.sln`.
Код — `backend/LunarNavigator.Api`, тести — `backend/LunarNavigator.Tests`.
Ці маршрути працюють без інтернету, ключів NASA або DEM.

## Запуск із кореня репозиторію

```sh
dotnet restore backend/LunarNavigator.sln
dotnet build backend/LunarNavigator.sln
dotnet test backend/LunarNavigator.sln
dotnet run --project backend/LunarNavigator.Api --urls http://localhost:5080
```

В іншому терміналі (`curl.exe` у Windows PowerShell):

```sh
curl -i http://localhost:5080/api/v1/health
curl -i http://localhost:5080/api/v1/config
curl -i http://localhost:5080/api/v1/landing-sites
```

`health` повертає стан HTTP-сервера й версію; доступність NASA або DEM не перевіряє.
`config` повертає регіон, налаштовані ліміти та доступні функції. Усі чотири наукові
feature flags поки `false`. `landing-sites` читає локальний JSON із явно позначеними
**DEMO** точками з TEAM_SPEC §7.3. Це не перевірені посадкові місця чи вимірювання NASA.

## Налаштування та каталог

Налаштування: `appsettings.json` та environment overrides, наприклад
`Api__MaxSamples=1500`, `Api__AllowedOrigins__0=http://localhost:5173`.
За замовчуванням список CORS origins порожній. Дозволені точні HTTP(S) origins без
шляхів, кінцевого слеша, credentials або wildcard; метод GET, без credentialed CORS.
Невалідні налаштування зупиняють запуск.

`Api__CatalogPath` задає абсолютний шлях до JSON або шлях відносно content root API.
Запис потребує id/name/description, скінченних latitude [-90,-80] і longitude [-180,180].
Усі записи з дубльованими ID (без урахування регістру) та невалідні записи вилучаються.
Логи містять лише кількість відхилених записів.

Звичайні записи потребують HTTPS sourceUrl без credentials. Формат URL перевіряється
офлайн; достовірність джерела перевіряє власник каталогу. Без sourceUrl дозволені записи
з id `demo-*`, name із префіксом `DEMO ` і description, що містить `DEMO`.
Відсутній, нечитабельний або пошкоджений каталог повертає 503 `CATALOG_UNAVAILABLE`;
health/config залишаються доступними. Порожній валідний каталог повертає `sites: []`.

Помилки мають формат `{ "error": { "code", "message", "details": null } }`, включно
з 404/405, validation та неочікуваними помилками. Внутрішні повідомлення винятків і файлові
шляхи не передаються клієнту. Читання каталогу підтримує request cancellation.
`IFoundationConfig` та `ILandingSiteCatalog` зареєстровані через DI.

## Integration pending: ARC-02

Контракти й fixtures тепер доступні в `contracts/` після merge. DTO BE-01 були створені за
§§7.1–7.3 і §7.11 у `docs/Lunar_Navigator_TEAM_SPEC.md`; точна звірка із замороженим OpenAPI
залишається кроком інтеграції. Коди `CATALOG_UNAVAILABLE`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`
також потребують звірки з ARC-02. Спільні контракти не змінювалися.

Для Windows-середовища без доступу до MSBuild worker/compiler servers:

```sh
dotnet test backend/LunarNavigator.sln --no-restore --disable-build-servers -m:1 -p:MSBuildEnableWorkloadResolver=false -p:UseSharedCompilation=false
```

Пов'язані задачі: BE-01 (наданий заголовок E-01), ARC-01, ARC-02.
