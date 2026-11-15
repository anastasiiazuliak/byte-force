import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { parse } from 'yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';
import { createApiClient } from '../api/client';
import { createMockTransport } from '../mocks/transport';
import type { AnalysisRequest } from '../api/types';

const contractPath = resolve('../contracts/openapi.yaml');
const document = parse(readFileSync(contractPath, 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'lunar', ...document });
function validate(name: string, value: unknown) {
  const check = ajv.compile({ $ref: `lunar#/components/schemas/${name}` });
  expect(check(value), `${name}: ${ajv.errorsText(check.errors)}`).toBe(true);
}
const request: AnalysisRequest = { location: { latitude: -89.5, longitude: 25 }, period: { startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-15T00:00:00Z', stepMinutes: 60 } };

describe('frozen contracts', () => {
  it('parses all team JSON fixtures and validates the contributed map metadata envelope', () => {
    const directory = resolve('../contracts/fixtures');
    const visit = (dir: string) => {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, item.name);
        if (item.isDirectory()) visit(path);
        else if (item.name.endsWith('.json')) expect(() => JSON.parse(readFileSync(path, 'utf8')), path).not.toThrow();
      }
    };
    visit(directory);
    validate('MapMetadataResponse', JSON.parse(readFileSync(join(directory, 'map-metadata-real.json'), 'utf8')).metadata);
  });

  it('is valid OpenAPI 3.1 and contains all seven agreed API operations', async () => {
    await SwaggerParser.validate(contractPath);
    expect(Object.keys(document.paths).sort()).toEqual(['/health','/config','/landing-sites','/map/metadata','/analyze','/compare','/ephemeris'].sort());
  });
  it('validates supplied JSON fixtures against canonical schemas', () => {
    validate('AnalysisResponse', JSON.parse(readFileSync(resolve('../contracts/fixtures/analyze-partial.json'), 'utf8')));
    validate('MapMetadataResponse', JSON.parse(readFileSync(resolve('../contracts/fixtures/map-metadata-unverified.json'), 'utf8')));
  });
  it('validates mock success responses and the explicit ephemeris-unavailable error', async () => {
    const client = createApiClient({ transport: createMockTransport() });
    for (const [schema, result] of [
      ['HealthResponse', await client.health()], ['ConfigResponse', await client.getConfig()],
      ['LandingSitesResponse', await client.getLandingSites()], ['MapMetadataResponse', await client.getMapMetadata()],
      ['AnalysisResponse', await client.analyze(request)],
      ['CompareResponse', await client.compare({ scenarios: [{ id: 'A', ...request }, { id: 'B', ...request }] })],
    ] as const) validate(schema, result);
    const response = await createMockTransport()('/api/v1/ephemeris', { method: 'POST', body: JSON.stringify(request.period) });
    expect(response.status).toBe(503);
    validate('ApiError', await response.json());
  });
  it('rejects invalid coordinates, non-nullable status and missing required response fields', () => {
    const check = ajv.compile({ $ref: 'lunar#/components/schemas/AnalysisRequest' });
    expect(check({ ...request, location: { latitude: 40, longitude: 25 } })).toBe(false);
    expect(ajv.compile({ $ref: 'lunar#/components/schemas/AnalysisResponse' })({ status: 'invented' })).toBe(false);
  });
  it('keeps TypeScript DTOs bidirectionally assignable to generated schema types, with documented v2 exceptions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lunar-contract-'));
    try {
      writeFileSync(join(dir, 'generated.ts'), astToString(await openapiTS(new URL(`file://${contractPath}`), { arrayLength: true, defaultNonNullable: false })));
      const names = ['Coordinates','Location','Period','BodyPosition','AnalysisSample','Interval','Summary','Quality','HorizonPoint','AnalysisResponse','CompareResponse','ConfigResponse','LandingSitesResponse','MapMetadataResponse','EphemerisRequest','EphemerisResponse','HealthResponse'];
      const assertions = names.map(name => `type ${name}Check = Assert<Equal<DTO.${name}, S['${name}']>>;`).join('\n');
      // Assignability instead of nominal equality: interface aliases and allOf intersections are equivalent.
      writeFileSync(join(dir, 'check.ts'), `import type * as DTO from '${resolve('../contracts/api-types').replaceAll('\\', '/')}';\nimport type { components } from './generated';\ntype S = components['schemas'];\ntype Equal<A,B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;\ntype Assert<T extends true> = T;\n${assertions}\n// Known v2 discrepancy: schema permits partial options while DTO requires both fields.\ntype OptionsMismatch = Assert<Equal<Equal<DTO.AnalysisOptions, S['AnalysisOptions']>, false>>;\ntype RequestToSchema = Assert<DTO.AnalysisRequest extends S['AnalysisRequest'] ? true : false>;\ntype CompareToSchema = Assert<DTO.CompareRequest extends S['CompareRequest'] ? true : false>;\n// OpenAPI generator emits Record<string, never> for an unconstrained object; JSON Schema permits arbitrary details.\ntype ErrorCheck = Assert<Equal<Omit<DTO.ApiError['error'], 'details'>, Omit<S['ApiError']['error'], 'details'>>>;\n`);
      const program = ts.createProgram([join(dir, 'check.ts')], { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext });
      const diagnostics = ts.getPreEmitDiagnostics(program);
      expect(diagnostics.map(d => `${d.file?.text.slice(d.file.text.lastIndexOf('\n', d.start ?? 0) + 1, d.file.text.indexOf('\n', d.start ?? 0))}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
