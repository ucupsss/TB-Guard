import fs from 'fs';
import path from 'path';

interface KeyState {
  key: string;
  cooldownUntil: number;
  totalCalls: number;
  failedCalls: number;
}

class GroqKeyPool {
  private keys: KeyState[] = [];
  private currentIndex = 0;
  private lastFileCheck = 0;
  private lastMtime = 0;

  constructor() {
    this.reloadKeys();
  }

  /** Membaca ulang daftar API key dari groq_keys.txt atau environment variable */
  public reloadKeys() {
    const filePath = path.join(process.cwd(), 'groq_keys.txt');
    const existingMap = new Map<string, KeyState>(this.keys.map((k) => [k.key, k]));
    const newKeys: string[] = [];

    // 1. Baca dari file groq_keys.txt (hot-reload)
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        this.lastMtime = stats.mtimeMs;
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('gsk_') && trimmed.length >= 20) {
            newKeys.push(trimmed);
          }
        }
      }
    } catch (err) {
      console.warn('[GroqKeyPool] Gagal membaca groq_keys.txt:', err);
    }

    // 2. Baca dari environment variable
    const envKeys = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
    if (envKeys) {
      const parts = envKeys.split(/[,\s\n]+/).map((s) => s.trim());
      for (const p of parts) {
        if (p.startsWith('gsk_') && !newKeys.includes(p)) {
          newKeys.push(p);
        }
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
    if (now - this.lastFileCheck < 3000) return; // batasi pengecekan file tiap 3 detik
    this.lastFileCheck = now;

    try {
      const filePath = path.join(process.cwd(), 'groq_keys.txt');
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs > this.lastMtime) {
          console.log('[GroqKeyPool] Perubahan groq_keys.txt terdeteksi, me-reload keys...');
          this.reloadKeys();
        }
      }
    } catch {
      // abaikan
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
