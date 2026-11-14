# Backend response schema checks

`ContractPayloadTests` exports 12 actual HTTP response payloads from TestServer into
`bin/<configuration>/net8.0/ContractResponses/`. Scientific success cases use explicitly synthetic,
test-only providers; they are never registered in production. The cases cover health/config/catalog,
complete/partial analysis, comparison, metadata, Moon-fixed output and contract errors.

From the repository root:

```sh
dotnet test backend/tests/LunarNavigator.Api.Tests --filter FullyQualifiedName~ContractPayloadTests
npm install --prefix backend/tests/LunarNavigator.Api.Tests/Contracts --no-audit --no-fund
node backend/tests/LunarNavigator.Api.Tests/Contracts/validate-openapi.cjs
```

For Release output pass its directory explicitly:

```sh
node backend/tests/LunarNavigator.Api.Tests/Contracts/validate-openapi.cjs backend/tests/LunarNavigator.Api.Tests/bin/Release/net8.0/ContractResponses
```

Ajv 2020 validates against the unchanged OpenAPI 3.1 schemas in `contracts/openapi.yaml`.
Dependencies are confined to this verification helper; frontend and production backend packages are unchanged.
