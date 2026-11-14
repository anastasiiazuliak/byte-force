# API tests

`LunarNavigator.Api.Tests` перевіряє HTTP routes, middleware, CORS, валідацію каталогу та DI providers.
Namespace відповідає проєкту; допоміжний ApiFactory — у `TestSupport/`.

```sh
dotnet test backend/tests/LunarNavigator.Api.Tests
```

Тести геометрії та data-провайдерів розташовані в сусідньому `LunarNavigator.Core.Tests`.
