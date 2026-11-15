# Stable .NET 10 migration — 2026-11-15

All **9 C# projects**, including the sample and four test projects, target `net10.0`.
The existing `backend/LunarNavigator.sln` still includes every project; no second solution is needed.
Root and backend `global.json` both select `10.0.100`, `rollForward: latestFeature`, prereleases disabled.
This accepts newer stable 10.0 feature bands/patches without pinning the developer to 10.0.113.
No runtime or CI command requires .NET 8. Historical reports/backlog descriptions retain their original version context.

NuGet stable packages verified against the official index: Microsoft.AspNetCore.Mvc.Testing **10.0.15**,
Microsoft.NET.Test.Sdk **18.12.0**. xUnit source/tests are preserved. CI selects `10.0.x`;
Docker uses SDK/ASP.NET **10.0**. Schema response output paths now use `net10.0`.
The launcher checks selected SDK major 10; active README/deployment/backend guides are updated.

## Actually validated

- SDK **10.0.113**, MSBuild 18.0.36, ASP.NET/Core runtime **10.0.13** on Linux.
- `dotnet restore backend/LunarNavigator.sln`: passed.
- `dotnet build backend/LunarNavigator.sln -c Release`: passed, no errors/warnings.
- `dotnet test backend/LunarNavigator.sln -c Release`: **162 passed, 1 opt-in live skipped**.
- Actual API process HTTP `/api/v1/health` **200**; runtimeconfig `tfm: net10.0` with
  Microsoft.AspNetCore.App 10.0.0 minimum; `/proc` of the launched API confirmed loaded
  `/usr/lib64/dotnet/shared/Microsoft.NETCore.App/10.0.13/libcoreclr.so`.
- API process stopped after bounded smoke. Evidence is local ignored `.validation/net10-runtime.json`.

These results establish a real .NET 10 launch, not just SDK selection compiling an older target.
Full release/science/browser results are recorded separately after subsequent changes.
