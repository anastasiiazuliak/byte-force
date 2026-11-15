# API regression tests

This .NET 10 project exercises HTTP routes, middleware, CORS, request/catalog validation, provider composition, quality propagation and exported contract payloads. Test support uses an in-process application factory; synthetic science providers are explicit test substitutes, not production registrations.

From the repository root:

```sh
dotnet test backend/tests/LunarNavigator.Api.Tests
```

[HTTP schema checks](Contracts/README.md) validate exported responses against canonical OpenAPI. [Terrain tests](../LunarNavigator.Core.Tests/Terrain/README.md) cover numerical sampling and source/mesh controls separately. Real-asset/live checks require explicit inputs or opt-ins; see the [scientific reference](../../../docs/science/TERRAIN_SCIENCE_REVIEW.md#reproducible-scientific-controls).

Current run results determine pass/skip counts. Synthetic API success cases do not certify real-source global visibility or an external deployment.
