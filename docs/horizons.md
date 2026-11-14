# NASA JPL Horizons — C#

Бібліотека `backend/LunarNavigator.Horizons` для .NET 8 не потребує сторонніх пакетів або API-ключа.
Вона отримує положення центрів Сонця та Землі для точки на Місяці в один момент часу.

## Де лежить код

Усі класи інтеграції з API вже відокремлені в папці `backend/LunarNavigator.Horizons`.
Приклад запуску й перевірки — окремі програми, які підключають цю бібліотеку:

```text
backend/LunarNavigator.Horizons/            ← класи для роботи з Horizons API
backend/samples/LunarNavigator.Horizons.Sample/           ← програма для реального запиту до NASA
backend/tests/LunarNavigator.Horizons.Tests/    ← перевірки без звернення до NASA
docs/horizons.md                   ← документація
backend/LunarNavigator.sln         ← єдине рішення для дев'яти C#-проєктів
```

LOLA/Terrain/Horizon реалізується окремо у `backend/LunarNavigator.Core/{Terrain,Horizon}/` за [frozen contract](../PARALLEL_CONTRACT.md). Усі namespaces мають префікс `LunarNavigator`; алгоритми Horizons не змінювалися. Усі проєкти використовують `net8.0` і входять до одного `backend/LunarNavigator.sln`.

## Використання

```csharp
using LunarNavigator.Horizons;
using LunarNavigator.Models;

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
IHorizonsClient horizons = new HorizonsClient(http);
var site = new LunarObserver(
    latitudeDegrees: -89.5,
    longitudeDegreesEast: 0,
    altitudeKilometers: 0);

var result = await horizons.GetObservationAsync(
    site,
    new DateTimeOffset(2026, 11, 13, 0, 0, 0, TimeSpan.Zero),
    cancellationToken);

Console.WriteLine(result.SunElevationDegrees);
Console.WriteLine(result.SunAzimuthDegrees);
Console.WriteLine(result.EarthElevationDegrees);
Console.WriteLine(result.EarthAzimuthDegrees);
Console.WriteLine(result.Time); // UTC
```

`cancellationToken` у прикладі — токен від виклику backend; можна пропустити цей аргумент.
Повторно використовуйте `HttpClient` (або зареєструйте `IHorizonsClient`/`HorizonsClient` як typed client через `AddHttpClient`).
Клієнт не закриває переданий `HttpClient`.

## Координати й результат

- Широта: від −90° до +90°; південь має від'ємний знак.
- Довгота: східна додатна, приймаються діапазони −180…180° та 0…360°.
- Висота: **кілометри** над опорною сферою Horizons радіусом 1737.4 км. Наприклад, 80 м = 0.08 км. Нуль означає опорну сферу, а не фактичну поверхню LOLA.
- Використовується місячна система mean-Earth. Перед інтеграцією LOLA необхідно узгодити систему координат та вертикальний датум DEM із Horizons; земна WGS84 тут непридатна.
- Азимут у градусах: північ 0°, схід 90°, південь 180°, захід 270°.
- Висота над горизонтом у градусах: −90…+90°. Від'ємні значення зберігаються.
- `Time` — UTC; вхідний `DateTimeOffset` може мати будь-який зсув. Підтримуються дати від 1962 року з точністю до мілісекунд; дрібніша точність відхиляється, щоб не змінювати момент мовчки. Доступність конкретної дати також залежить від ефемерид NASA.

## Запити та помилки

Для одного результату надсилаються два послідовні GET-запити: `COMMAND=10` (Sun) і `COMMAND=399` (Earth).
Місце спостереження: `CENTER=coord@301`, `COORD_TYPE=GEODETIC`, `SITE_COORD=longitude,latitude,altitude`.
Час задається через `TLIST`, `TIME_TYPE=UT`, `TIME_ZONE=+00:00`.
Потрібні кути повертає `QUANTITIES=4`, із `APPARENT=AIRLESS`, `CSV_FORMAT=YES`.
`ELEV_CUT=-90` зберігає об'єкти під горизонтом.

Клієнт читає JSON-обгортку, перевіряє API version та CSV між `$$SOE` і `$$EOE`, назви колонок, час і діапазони кутів.
Підтримуються версії 1.2 (перевірена на реальному сервісі) та 1.3 (задокументована NASA).
`HorizonsException` означає помилку API, недоступні значення `n.a.` або неочікуваний формат.
`HttpRequestException` означає HTTP/мережеву помилку; скасування та timeout використовують стандартні винятки .NET.
Частковий результат не повертається, якщо один із двох запитів завершився невдало.
Запити всіх екземплярів клієнта в одному процесі серіалізуються відповідно до рекомендацій JPL. Для кількох процесів координацію слід забезпечити окремо.

## Межа з LOLA

Це **airless apparent** координати центрів тіл: Horizons враховує час поширення світла та астрономічні поправки,
але не місячний рельєф. Це не режим геометричних векторів без поправок.
Додатна висота означає положення центра над ідеальним горизонтом, а не гарантовану видимість.
Розміри дисків Сонця/Землі та локальні перешкоди цим клієнтом не оцінюються.
LOLA DEM, GDAL і розрахунок профілю місцевого горизонту потрібно додати окремим сервісом.

## Запуск

```powershell
# Зібрати бібліотеку, приклад і перевірки.
dotnet build backend/LunarNavigator.sln

# Перевірити клієнт без інтернету.
dotnet test backend/LunarNavigator.sln

# LIVE OPT-IN: лише після явного дозволу; викликає NASA через інтернет.
dotnet run --project backend/samples/LunarNavigator.Horizons.Sample
```

У solution є 19 Horizons, 5 Models, 8 Core/coordinates та 22 API cases. Ці офлайн-перевірки не є живою перевіркою NASA. Команди вище — інструкції; історичні результати bootstrap наведено у [parent validation](integration/bootstrap-validation.md).

Тести використовують xUnit і підставний HTTP handler; лише sample викликає NASA через інтернет.
`HorizonsClientRequestTests` і `HorizonsClientResponseTests` розташовані в `LunarNavigator.Horizons.Tests`, `LunarObserverTests` — у `LunarNavigator.Models.Tests`, а `LunarCoordinatesTests` — у `LunarNavigator.Core.Tests.Coordinates`. Усі тестові проєкти зібрані в `backend/tests/`.
Допоміжні HTTP-відповіді й handler розташовані в `TestSupport`. Пакети для тестів завантажуються з NuGet під час першої збірки.

Джерела: [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html),
[системи координат і значення observer quantities](https://ssd.jpl.nasa.gov/horizons/manual.html).

Спільні типи `LunarObserver` і `LunarObservation` розташовані в `backend/LunarNavigator.Models/` (namespace `LunarNavigator.Models`); Horizons підключає їх через ProjectReference.
