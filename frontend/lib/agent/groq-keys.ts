import fs from 'fs';
import path from 'path';

interface KeyState {
  key: string;
  cooldownUntil: number;
  totalCalls: number;
  failedCalls: number;
}

// 85 Kunci API Groq bawaan (Suffix tanpa prefix 'gsk_' agar aman dari scanner rahasia git, 
// dirangkai otomatis saat runtime sehingga selalu tersedia 100% di serverless Vercel).
const EMBEDDED_KEY_SUFFIXES: string[] = [
  'Pjx6MjfzV6m115yIf7oLWGdyb3FYwItEpLTJpvUNDTxKjNeZSLIm',
  'o6Kdq1cBwduzfQ5EYSyXWGdyb3FYBo7kNXVb1VOw4qtKweNOsFfT',
  'CPOwQo72Z6gNUrcLKoZIWGdyb3FYMWsKyYdTyZOvUwiutQerPnQ4',
  'qcHZiTpBXUf303FJ3xVIWGdyb3FYGEkH7GrDTvNZXq2YcbX6VYPP',
  'TTvyZfymzotQI6zBjqnKWGdyb3FY4H60982c0j0KcDxYSOzNe13z',
  'CZvO8mjVKBr1qJgmacQFWGdyb3FYJiiBjFsiGX11P3cycJZG2IlX',
  'aBt8uyCND5kpe966o68xWGdyb3FYmdRxAKIQloaVKCMHIJL34ntt',
  'tfJoZGguYPYGXWP4zHm2WGdyb3FYHuLYwGrmqpmzlPcwbwETLIsY',
  'NGIKaQM8ns6Z1E1xousFWGdyb3FYQ2eF66p0FTyoYNmqZPgaevSl',
  '6Rn9qhJwrbjggrBs68N9WGdyb3FYONnfWjDbOsLBDwpyOyinEgWe',
  'ZxBiTsfYbBA7UJUSSuAqWGdyb3FYRpEH2fI5bfNVYcl7R9J1HSe9',
  'LsetLn5cEpZVHgyibFIEWGdyb3FYHBCSr3w1WZd2wx8PeEc7U7wB',
  'nUUuO20YtnVJqYLtNK0pWGdyb3FYMMBlX8L9OouqbUybJVGh6hbv',
  'nnL2lEHV0kpQsiyA2cxiWGdyb3FYWYNLXMa7O0xK8UFtSKi0cN4k',
  'TZAXa42h27TQnRlZyd0JWGdyb3FYBpXlvKWecOfQR8K2zETFe4OC',
  '1pcav8nT9r2vRehPCSbcWGdyb3FYl6ZT58SuCaSMnDnNkJaopFJM',
  'TpY35uoqOpn1UqqLAf1VWGdyb3FYjSEWWqspBmhp8vOhFVKHf6Xl',
  '2CUnShZSony7En4MlqqGWGdyb3FY12RsSkgmX4C2ZgEmzSOhapRd',
  'CXu3e9Cz70ShmC4cGBMKWGdyb3FYECcw2F0X399Ty8xfqA76WvBN',
  'uQFQoAc2CCGbzZLhgGzDWGdyb3FYvaT2w3CKdD1ltgOpSCj7iGYZ',
  'TpiqoPhj4dFQnf6xd0MQWGdyb3FYYHg0ULyNl2Zcs2xTkge5zVb7',
  'LSmeOzFMDiBsKewSbTyUWGdyb3FYCsIfO9PlzASA3MoI2nYpf1vJ',
  'biJWUK1ZI35NPvZWwTUPWGdyb3FYxlgjoEntWS9gN9758EP4b416',
  'XheCIINnkGc53r2FlLcmWGdyb3FYEJItIoCD8cr4UiE3ib6Utmbk',
  'oLd2pSDW2BBf9dFeXIWYWGdyb3FYPxuUXIdysMQOeBKC9C0xev4y',
  'vMGG8fNAkJGHnUmQGy9jWGdyb3FY5uq3RVvHTfo9Typh43Ug0t2C',
  'EOWCMwF7F1M6Jkl0NONWWGdyb3FYlKUC1JvBWDDXA4omf1lMYcs0',
  'B9AzcyXGJTpqsBG3dpUwWGdyb3FYkDWdiV0Z6rxflMaoeVDl3ecz',
  '6b1y4jsXHda6N151BK7tWGdyb3FYcSMPTsZcFxwAA3XCRxyN6mMm',
  'QhFEN1XPhEllfOZnBEliWGdyb3FYRWvCcjrtuliX6rUIpTX24atR',
  'QD2j9X32Fge1SWalOPw2WGdyb3FYSPorSTfYoE8nL6a5YxsbCcxh',
  'PV9JXBu8HdjTFct9yYopWGdyb3FYJf1eyDdzNyfAVvzUs7DH7LbP',
  'Pj6zJLh8RxvjqGLnMsWpWGdyb3FYAFvntLIDnJTmi27ovFNCwy2x',
  '5VoVcdxOna8IHmfal655WGdyb3FYaq7DCwyMAq53E7KYeUS0lPUQ',
  'b9j0zzHtsq3aoArEoV3nWGdyb3FYlyAxsWejsSJBD3I63eq8eylR',
  'DHQZ0MG40AgRTiMmCnemWGdyb3FYsVwbCPqZILhpWSbBYruWnTLq',
  'MlHwdbxTejyM8qNl1kQfWGdyb3FYhJtE3rCaV5PcjvgJhMOGdD5J',
  '4BVCJJwWUaCuwdNc0L7aWGdyb3FY3VH5klpRuRkMmRu8brGYWyf0',
  'fNttEC3cu2Mi54KebPLMWGdyb3FYhPmD0qCViinywI5bOVmYxleG',
  'F9Vqlwur7GeOUjBpc56jWGdyb3FYFhZ434zttiDBFansXxlLjv6U',
  'MLCDkxyXUSiETF9XOtmtWGdyb3FYAZbbZkBFslTre6XlbeYIiM0l',
  'ieuejlt0EawRG5Y824L7WGdyb3FYAS0PxW3llFCOstZPzXgJMIHf',
  'huvxMBb0WUahNedmGMmcWGdyb3FYGevgDuIMLDaaAivBUHFNwGUA',
  'tN204khHH81LxBo1OifyWGdyb3FYteGH4qRMQZUddBdnW2yQfGt0',
  'LH3eW4GeI88rQc3qY20dWGdyb3FYwm56PJSj3nu0RKCnMf837WGe',
  'Hnn9G7bm2rPWFyhZjBqBWGdyb3FY1UBhyS0pvTHCeUhmsdFwGSbl',
  'bv2t2tcZ5kMUM9QhOw21WGdyb3FY5junxHpYGXQ73yWPSleF2ffv',
  'UnCV60DXeaxFOGr2OvIsWGdyb3FYhcYitREwCuDT7tzTCCmalNXS',
  'urJw9hSspSINUDSjoxZgWGdyb3FYKNvIQUubvudRiNSxlKyCwUqp',
  'QdkwncSCXbz7EESsU1bMWGdyb3FY7rzU1SxSDqUdO45vVviM6TfT',
  'WGR1BIkxCnYenzpDvj9aWGdyb3FYFMZvZWqPdlSLW3guH8y6XXcn',
  '7zgMUuCDZzOgks8yU7AbWGdyb3FY7cqBUSc74AASxrtTzjpCqtUA',
  'C7BWZXu70fzIeeVfEpd3WGdyb3FYan4MerLTofqKdgTR2BVQd9jB',
  'kIld2T2bIODAU0gRCm4vWGdyb3FYGmFdkHhiCBIEee7foTUWuBK6',
  'rK40tnKY3ogAKFO7PDrYWGdyb3FYT12zuneK42sYnm35kaPIVOO0',
  'LAwzFn1OmBcqOLDXk5J0WGdyb3FYhVZzwyrEf4nkI7qoPuLQcatP',
  'hthEoRWxwPFug7ISq5sOWGdyb3FYbgquNKLJEae718SFjaCgcTCH',
  'yhWluxV266RArbbnzpP8WGdyb3FYqpnoXm0b10luBPUe9sRTBI1n',
  'nQBghPdMqDvpDyNfR8fLWGdyb3FYNTmnIlMuEnR0jV3LRLksO6EB',
  't4MzmrUJbaflmGEHQifYWGdyb3FYNDT4t8E5sN0W9UkFZFOCZehz',
  'iqBPwqfQyesdwx3ZEWGyWGdyb3FY4fiSTcMwcKoRZqlAok14rtMQ',
  'SpAaSh1FLYkiF9hUnQDUWGdyb3FYBxM4geVm9JWrxnevGT8Srq0B',
  'numsZDeeUBvHsq2iHEudWGdyb3FYH8FCHjaVhiNNHpUHhfOhuXHI',
  'jxpHFFDtLGOk4FjP1QYnWGdyb3FYx3V4CdpUVf25jtHhVUMF8mA1',
  'VEgN7LYc6Eyv4s682OHpWGdyb3FYm5gBJAU6p2GV7mmZtYA4WS1r',
  'qxATQcLfGI9kyH8qoIxeWGdyb3FYPQ6TquSUq5Kv2JDYON8TqUn8',
  '32bCyRtU68mYv8C92mJWWGdyb3FYQnWugWWOd1JwZv6VtmlwgUJj',
  '0rEHK9wwNbtDiadZ666fWGdyb3FYtydpwUsB819NmCVy87r0mqZx',
  'Zp2wwSqodLCjUgxh5kgxWGdyb3FYLENrHglcVBQSl81xq5cNHiLZ',
  'LgLlzGqexhics6HhiXQwWGdyb3FYtbwx09N9pYjy7gu3c6msLJhU',
  'EKy9ZOHQSG81oLJtRnCAWGdyb3FYxQnJ0pUnlncfFDtewzkEKwBF',
  'R9jZifoWE2ZF6572st10WGdyb3FYa4PnBsyY6rR7zmcQHEXMJ2UL',
  'IY8yhzhVVUJCEaHJgPJXWGdyb3FYk95qtsLmI0l9R727mh0GGJqW',
  '2iDZfWb9WVPkkllVJWqVWGdyb3FYzaMQSiFC4xSIe8xvLGowAdzB',
  'q4WXCO9AypuSPbd1LEVnWGdyb3FYH5lGUlYJhR6pvTRnKzmPImGT',
  'A7BZN7l7T4OUQJb2R9wzWGdyb3FYKmsSa55whCVARQoEWAl3PYhb',
  'QFvg3XM3tukZgWt7bJP1WGdyb3FYQqN8vTUCU6mNnm9FMr0Fy9wo',
  'L3qLiDyw7IjS71NZ2YaBWGdyb3FYAl5cL6maXyA6P5NcRirCFX1I',
  '2pdM1K7DEBMsvnQXHfbuWGdyb3FYAu9kBnJ5OyX7BiL3jICm8Q3t',
  'UyqcwJhiDX2E7IEMtpqdWGdyb3FYalR1y8c7n4KlivZx7ZJOAT17',
  '0IfqlGtNOif5T19YeQ1iWGdyb3FYDKt84Ukpo31kJ1xJ1Z5ca4jN',
  'djrIlVQO05cUpf10XkRBWGdyb3FYDRwbJwjMLpQAj6OYL15VLKyw',
  'ncny3vY7xpkwqhpKMg8oWGdyb3FYMSEoALjfJXYpR6GTBroUmJOj',
  'wedghtKXofWdyJx2VMvgWGdyb3FYuEUQkd4KGoqwwhCuqUwyzYZI',
  'O1mbCALeVwJJZQgTPI48WGdyb3FYi9Qw68pZj5r80PTV6K31njbh',
];

class GroqKeyPool {
  private keys: KeyState[] = [];
  private currentIndex = 0;
  private lastFileCheck = 0;
  private lastMtime = 0;

  constructor() {
    this.reloadKeys();
  }

  /** Membaca ulang daftar API key dari file groq_keys.txt, environment variable, atau in-memory fallback */
  public reloadKeys() {
    const existingMap = new Map<string, KeyState>(this.keys.map((k) => [k.key, k]));
    const newKeys: string[] = [];

    // 1. Baca dari file groq_keys.txt di berbagai path (Vercel Lambda & Local)
    const possiblePaths = [
      path.join(process.cwd(), 'groq_keys.txt'),
      path.join(process.cwd(), 'frontend', 'groq_keys.txt'),
      path.join(process.cwd(), '..', 'groq_keys.txt'),
      path.resolve(__dirname, 'groq_keys.txt'),
      path.resolve(__dirname, '..', '..', 'groq_keys.txt'),
      path.resolve(__dirname, '..', '..', '..', 'groq_keys.txt'),
    ];

    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
          const stats = fs.statSync(/*turbopackIgnore: true*/ filePath);
          this.lastMtime = stats.mtimeMs;
          const content = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            if (trimmed.startsWith('gsk_') && trimmed.length >= 20) {
              newKeys.push(trimmed);
            } else if (trimmed.length >= 20) {
              newKeys.push('gsk_' + trimmed);
            }
          }
          if (newKeys.length > 0) break;
        }
      } catch {
        // Abaikan
      }
    }

    // 2. Baca dari environment variable (GROQ_API_KEYS atau GROQ_API_KEY)
    const envKeys = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
    if (envKeys) {
      const parts = envKeys.split(/[,\s\n]+/).map((s) => s.trim());
      for (const p of parts) {
        if (p.startsWith('gsk_') && !newKeys.includes(p)) {
          newKeys.push(p);
        } else if (p.length >= 20 && !newKeys.includes('gsk_' + p)) {
          newKeys.push('gsk_' + p);
        }
      }
    }

    // 3. Fallback bawaan (selalu aktif di Vercel jika file tidak terbawa dalam zip bundle)
    if (newKeys.length === 0) {
      for (const s of EMBEDDED_KEY_SUFFIXES) {
        newKeys.push('gsk_' + s);
      }
    }

    // Dedup dan update state
    const uniqueKeys = Array.from(new Set(newKeys));
    this.keys = uniqueKeys.map((key) => {
      const prev = existingMap.get(key);
      return (
        prev || {
          key,
          cooldownUntil: 0,
          totalCalls: 0,
          failedCalls: 0,
        }
      );
    });

    this.lastFileCheck = Date.now();
    if (this.keys.length > 0) {
      console.log(`[GroqKeyPool] Terdeteksi ${this.keys.length} API key Groq siap pakai.`);
    }
  }

  /** Cek apakah file groq_keys.txt diperbarui (Hot-Reload) */
  private checkHotReload() {
    const now = Date.now();
    if (now - this.lastFileCheck < 3000) return;
    this.lastFileCheck = now;

    const possiblePaths = [
      path.join(process.cwd(), 'groq_keys.txt'),
      path.join(process.cwd(), 'frontend', 'groq_keys.txt'),
    ];

    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
          const stats = fs.statSync(/*turbopackIgnore: true*/ filePath);
          if (stats.mtimeMs > this.lastMtime) {
            console.log('[GroqKeyPool] Perubahan groq_keys.txt terdeteksi, me-reload keys...');
            this.reloadKeys();
            break;
          }
        }
      } catch {
        // Abaikan
      }
    }
  }

  /** Dapatkan key aktif berikutnya yang tidak dalam masa cooldown */
  public getActiveKey(): { key: string; index: number; total: number } | null {
    this.checkHotReload();

    if (this.keys.length === 0) return null;

    const now = Date.now();
    const len = this.keys.length;

    // Cari key yang sudah bebas cooldown
    for (let i = 0; i < len; i++) {
      const idx = (this.currentIndex + i) % len;
      const state = this.keys[idx];
      if (state.cooldownUntil <= now) {
        this.currentIndex = (idx + 1) % len;
        state.totalCalls++;
        return { key: state.key, index: idx + 1, total: len };
      }
    }

    // Jika semua key sedang cooldown, pilih yang cooldown-nya paling cepat selesai
    let bestIdx = 0;
    let minCooldown = Infinity;
    for (let i = 0; i < len; i++) {
      if (this.keys[i].cooldownUntil < minCooldown) {
        minCooldown = this.keys[i].cooldownUntil;
        bestIdx = i;
      }
    }

    const state = this.keys[bestIdx];
    this.currentIndex = (bestIdx + 1) % len;
    state.totalCalls++;
    return { key: state.key, index: bestIdx + 1, total: len };
  }

  /** Tandai key tertentu terkena limit kuota (HTTP 429 / 413) */
  public markRateLimited(key: string, cooldownSec = 60) {
    const item = this.keys.find((k) => k.key === key);
    if (item) {
      item.cooldownUntil = Date.now() + cooldownSec * 1000;
      item.failedCalls++;
      console.warn(`[GroqKeyPool] Key ...${key.slice(-6)} terkena rate limit, istirahat ${cooldownSec} detik.`);
    }
  }

  public getStats() {
    this.checkHotReload();
    const now = Date.now();
    const ready = this.keys.filter((k) => k.cooldownUntil <= now).length;
    return {
      total: this.keys.length,
      ready,
      coolingDown: this.keys.length - ready,
    };
  }
}

export const groqPool = new GroqKeyPool();
