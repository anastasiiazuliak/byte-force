const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const Ajv = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats');

const root = path.resolve(__dirname, '../../../..');
const contract = YAML.parse(fs.readFileSync(path.join(root, 'contracts/openapi.yaml'), 'utf8'));
const directory = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../bin/Debug/net10.0/ContractResponses');
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const files = fs.readdirSync(directory).filter(file => file.endsWith('.json'));
if (files.length !== 12) throw new Error('Run ContractPayloadTests first: expected exactly 12 HTTP response payloads.');
let passed = 0;
for (const file of files) {
  const name = file.split('.')[0];
  const validate = ajv.compile({ components: contract.components, $ref: '#/components/schemas/' + name });
  const payload = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
  if (!validate(payload)) {
    console.error(file, JSON.stringify(validate.errors));
    process.exitCode = 1;
  } else {
    passed++;
  }
}
console.log(`${passed}/${files.length} backend HTTP response payloads passed frozen OpenAPI 3.1 schema validation.`);
