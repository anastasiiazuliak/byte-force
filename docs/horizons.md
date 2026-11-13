# NASA JPL Horizons — C#

Бібліотека `src/ByteForce.Horizons` для .NET 10 не потребує сторонніх пакетів або API-ключа.
Вона отримує положення центрів Сонця та Землі для точки на Місяці в один момент часу.

## Де лежить код

Усі класи інтеграції з API вже відокремлені в папці `src/ByteForce.Horizons`.
Приклад запуску й перевірки — окремі програми, які підключають цю бібліотеку:

```text
src/ByteForce.Horizons/            ← класи для роботи з Horizons API
samples/Horizons.Sample/           ← програма для реального запиту до NASA
tests/ByteForce.Horizons.Tests/    ← перевірки без звернення до NASA
docs/horizons.md                   ← документація
ByteForce.slnx                    ← рішення, яке об'єднує три C#-проєкти
```

Модуль LOLA ще не додано; для нього передбачаємо окрему папку `src/ByteForce.Lola`.

## Використання

```csharp
using ByteForce.Horizons;

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
dotnet build ByteForce.slnx

# Перевірити клієнт без інтернету.
dotnet test ByteForce.slnx

# Викликати Horizons API та вивести результат від NASA.
dotnet run --project samples/Horizons.Sample
```

Тести використовують xUnit і підставний HTTP handler; лише sample викликає NASA через інтернет.
Тестові класи розділені за призначенням: `LunarObserverTests`, `HorizonsClientRequestTests`, `HorizonsClientResponseTests`.
Допоміжні HTTP-відповіді й handler розташовані в `TestSupport`. Пакети для тестів завантажуються з NuGet під час першої збірки.

Джерела: [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html),
[системи координат і значення observer quantities](https://ssd.jpl.nasa.gov/horizons/manual.html).
