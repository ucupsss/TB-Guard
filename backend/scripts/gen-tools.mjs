// Regenerasi internal/ai/tools.json dari definisi tool di frontend.
// Jalankan dari folder backend:  node --experimental-strip-types scripts/gen-tools.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const src = path.resolve('../frontend/lib/agent/tools.ts');
const tmp = path.join(os.tmpdir(), 'tbguard_tools.ts'); // salinan agar tidak terikat tsconfig frontend
fs.copyFileSync(src, tmp);
const { TOOLS } = await import(pathToFileURL(tmp).href);
const out = TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
fs.writeFileSync('internal/ai/tools.json', JSON.stringify(out));
console.log(`${out.length} tool ditulis ke internal/ai/tools.json`);
