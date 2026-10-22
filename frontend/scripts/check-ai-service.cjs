const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../lib/ai-service.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
async function check(fetch) {
  const exports = {};
  vm.runInNewContext(outputText, { exports, process: { env: {} }, fetch, FormData, Blob, Math });
  return exports.classifyLiveAudioBlob(new Blob(['test'], { type: 'audio/wav' }));
}
(async () => {
  await assert.rejects(check(async () => { throw new Error('offline'); }), /belum dianalisis/);
  await assert.rejects(check(async () => ({ ok: false, status: 503 })), /belum dianalisis/);
  const real = { uuid: 'server-result', result: 'NEG' };
  assert.deepEqual(await check(async () => ({ ok: true, json: async () => real })), real);
  console.log('PASS: unavailable inference rejects; successful response is preserved');
})().catch(error => { console.error(error); process.exitCode = 1; });
