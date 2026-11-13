# Lunar Landing Navigator — Byte Force

Проєкт для оцінювання точок посадки на Місяці за положенням Сонця й Землі та впливом рельєфу на їхню видимість.

## Технологічний стек

| Технологія | Версія / призначення |
| --- | --- |
| C# / .NET | .NET 10, цільова платформа `net10.0` |
| `HttpClient`, `System.Text.Json` | Вбудовані бібліотеки .NET 10 для HTTP та JSON |
| xUnit / Test SDK | xUnit 2.9.3, runner 3.1.1, Microsoft.NET.Test.Sdk 17.13.0 |
| NASA JPL Horizons API | Положення Сонця й Землі |
| LOLA DEM | Дані висот місячної поверхні |

## Вимоги

Установіть [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) версії `10.0.x`.
Для запитів до NASA потрібен інтернет.
Тестові пакети автоматично завантажуються з NuGet під час першої збірки.

## Збірка та запуск

Виконуйте команди з кореня репозиторію:

```powershell
# Збірка
dotnet build ByteForce.slnx

# Тести
dotnet test ByteForce.slnx

# Запуск прикладу Horizons
dotnet run --project samples/Horizons.Sample
```
