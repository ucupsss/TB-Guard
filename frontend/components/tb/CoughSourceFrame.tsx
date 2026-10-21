'use client';

import * as React from 'react';
import { azToX, type Attribution, type Box } from '@/lib/cough-vision';

const flip = (b: Box): Box => ({ ...b, x: 1 - b.x - b.w });
/** kotak wajah diberi sedikit ruang supaya dahi & dagu ikut */
const pad = (b: Box): Box => ({ x: b.x - b.w * 0.12, y: b.y - b.h * 0.18, w: b.w * 1.24, h: b.h * 1.3 });

/** frame kamera laptop pada momen batuk + kotak tiap orang; gaya sama dengan CameraFrame di detail batuk.
    Ditampilkan mirror (seperti pratinjau webcam) supaya kiri-kanan sesuai yang dilihat pengguna. */
export function CoughSourceFrame({ att, tb, blurFaces, doa }: { att: Attribution; tb: boolean; blurFaces: boolean; doa?: { az: number; sigma: number } }) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const W = att.image.width, H = att.image.height;

  React.useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.translate(W, 0); ctx.scale(-1, 1);
    ctx.drawImage(att.image, 0, 0);
    ctx.restore();
    if (!blurFaces) return;
    for (const p of att.people) {
      const f = flip(p.face), x = f.x * W, y = f.y * H, w = f.w * W, h = f.h * H;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 6, h / 2 + 10, 0, 0, Math.PI * 2); ctx.clip();
      ctx.filter = 'blur(14px)';
      ctx.translate(W, 0); ctx.scale(-1, 1);
      ctx.drawImage(att.image, 0, 0);
      ctx.restore();
    }
  }, [att, blurFaces, W, H]);

  const boxC = tb ? '#ff6b6b' : '#FBC500';
  return (
    <div className="relative overflow-hidden rounded-md bg-slate-900">
      <canvas ref={canvas} width={W} height={H} className="block w-full" />
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Frame kamera dengan kotak orang yang terdeteksi batuk">
        {att.people.map((p, i) => {
          const b = flip(pad(p.face)), x = b.x * W, y = b.y * H, w = b.w * W, h = b.h * H;
          const src = i === att.source && !att.ambiguous;
          const cand = att.ambiguous && i < 2;
          const label = src ? `Sumber batuk · ${(p.share * 100).toFixed(0)}%` : cand ? `Kandidat ${i + 1} · ${(p.share * 100).toFixed(0)}%` : `person ${(p.share * 100).toFixed(0)}%`;
          const lw = label.length * 6.6 + 14, lx = Math.max(4, Math.min(W - lw - 4, x)), ly = Math.max(0, y - 24);
          return src || cand ? (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="none" stroke={boxC} strokeWidth="3" strokeDasharray={cand ? '8 5' : undefined} rx="3" />
              <rect x={lx} y={ly} width={lw} height="22" fill={boxC} rx="3" />
              <text x={lx + 7} y={ly + 15} fontSize="12" fontWeight="500" fill="#111827">{label}</text>
            </g>
          ) : (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="none" stroke="#93b4f5" strokeOpacity=".7" strokeWidth="1.5" rx="2" />
              <text x={x + 2} y={Math.max(12, y - 6)} fontSize="11" fill="#93b4f5">{label}</text>
            </g>
          );
        })}
        {doa && (() => {
          // sektor ketidakpastian arah suara + garis arah, gaya sama dengan garis DoA di detail batuk
          const x = azToX(doa.az) * W, x0 = Math.max(0, azToX(doa.az - doa.sigma) * W), x1 = Math.min(W, azToX(doa.az + doa.sigma) * W);
          return (
            <g>
              <rect x={x0} y="0" width={Math.max(0, x1 - x0)} height={H} fill="#FBC500" fillOpacity=".08" />
              <line x1={x} y1="0" x2={x} y2={H} stroke="#FBC500" strokeWidth="1.5" strokeDasharray="6 6" opacity=".9" />
              <text x={Math.min(W - 90, x + 6)} y="18" fontSize="11" fill="#FBC500">DoA {doa.az > 0 ? '+' : ''}{doa.az.toFixed(0)}°</text>
            </g>
          );
        })()}
        <rect x="10" y={H - 34} width="200" height="24" rx="4" fill="rgba(0,0,0,.5)" />
        <circle cx="24" cy={H - 22} r="5" fill="#ff5b5b" />
        <text x="36" y={H - 17} fontSize="12" fill="#e2e8f0" fontFamily="ui-monospace, Consolas, monospace">CAM laptop · t={att.onsetSec.toFixed(2)}s</text>
        {!att.people.length && (
          <g><rect x={W / 2 - 160} y={H / 2 - 22} width="320" height="44" rx="8" fill="rgba(0,0,0,.6)" />
            <text x={W / 2} y={H / 2 + 5} textAnchor="middle" fontSize="14" fill="#fff">Tidak ada orang terdeteksi di kamera</text></g>
        )}
      </svg>
    </div>
  );
}
