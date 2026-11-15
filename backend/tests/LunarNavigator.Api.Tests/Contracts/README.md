# Backend response schema checks

`ContractPayloadTests` exports 12 actual TestServer HTTP payloads into `bin/<configuration>/net10.0/ContractResponses/`. Scientific success cases use explicitly synthetic test-only providers, never production registrations. Cases cover health/config/catalog, complete/partial analysis, comparison, metadata, Moon-fixed output and contract errors.

From the repository root:

```sh
dotnet test backend/tests/LunarNavigator.Api.Tests --configuration Release --filter FullyQualifiedName~ContractPayloadTests
npm ci --prefix backend/tests/LunarNavigator.Api.Tests/Contracts
node backend/tests/LunarNavigator.Api.Tests/Contracts/validate-openapi.cjs backend/tests/LunarNavigator.Api.Tests/bin/Release/net10.0/ContractResponses
```

Run the .NET export first. Without an explicit directory, the validator looks for Debug output. Ajv 2020 validates exported payloads against the unchanged [OpenAPI 3.1 schemas](../../../../contracts/openapi.yaml). Dependencies are confined to this verification helper; this is not runtime response-schema validation in the frontend client or production API.

See [development](../../../../docs/DEVELOPMENT.md) for solution-wide and CI commands. Schema compatibility does not establish scientific ground truth or a complete real-source visibility solution.
