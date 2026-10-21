'use client';

import { cn } from '@/lib/utils';

/* ilustrasi untuk dua kartu promo di dashboard */
export function NurseIllustration({ className }: { className?: string }) {
  return (
    <img
      src="/images/nurse.png"
      alt="Perawat TB-Guard"
      className={cn('object-contain object-bottom pointer-events-none select-none', className)}
    />
  );
}

export function PhoneIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 170" className={className} aria-hidden="true">
      <g transform="rotate(-18 80 85)">
        <rect x="40" y="10" width="86" height="150" rx="14" fill="#fff" stroke="#1a1f36" strokeWidth="5" />
        <rect x="70" y="18" width="26" height="5" rx="2.5" fill="#1a1f36" />
        <rect x="52" y="34" width="62" height="10" rx="3" fill="#e8eefb" />
        <path d="M58 70h4M64 62v16M70 56v28M76 64v12M82 52v36M88 60v20M94 66v8M100 70h4" stroke="#1C3FAA" strokeWidth="3" strokeLinecap="round" />
        <rect x="52" y="104" width="62" height="16" rx="8" fill="#1C3FAA" />
        <circle cx="83" cy="140" r="9" fill="#e8eefb" />
        <path d="M78 140l4 4 7-8" stroke="#91C714" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
