// Regenerasi internal/data/seed/seed.json (data simulasi) dari generator ber-seed di scripts/seed/data.ts.
// Jalankan dari folder backend:  node --experimental-strip-types scripts/gen-seed.mjs
import fs from 'node:fs';
import { seed } from './seed/data.ts';

fs.writeFileSync('internal/data/seed/seed.json', JSON.stringify(seed));
console.log(Object.entries(seed).map(([k, v]) => `${k}=${v.length}`).join(' '));
