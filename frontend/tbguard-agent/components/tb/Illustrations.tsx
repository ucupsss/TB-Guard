'use client';

/* ilustrasi orisinal untuk dua kartu promo di dashboard */
export function NurseIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 180" className={className} aria-hidden="true">
      <ellipse cx="120" cy="170" rx="80" ry="8" fill="#000" opacity=".15" />
      <circle cx="132" cy="38" r="20" fill="#1a1f36" />
      <circle cx="128" cy="44" r="15" fill="#f2c4a8" />
      <path d="M104 64c10-6 40-6 52 2l10 46-18 6-4 50h-32l-2-50-18-6z" fill="#dfe8fb" />
      <path d="M118 66h28l-4 22h-20z" fill="#fff" />
      <path d="M130 70v14M123 77h14" stroke="#D32929" strokeWidth="4" strokeLinecap="round" />
      <path d="M156 72l30-24" stroke="#f2c4a8" strokeWidth="9" strokeLinecap="round" />
      <path d="M104 72l-26 22" stroke="#f2c4a8" strokeWidth="9" strokeLinecap="round" />
      <rect x="176" y="22" width="34" height="44" rx="4" fill="#fff" transform="rotate(14 193 44)" />
      <path d="M184 34h18M184 42h18M184 50h12" stroke="#93b4f5" strokeWidth="3" transform="rotate(14 193 44)" />
      <path d="M112 168v-40h14v40zM136 168v-40h14v40z" fill="#1a1f36" />
      <path d="M48 120c-10-16-6-38 10-46" stroke="#fff" strokeOpacity=".5" strokeWidth="3" fill="none" />
      <path d="M34 128c-16-24-10-56 14-68" stroke="#fff" strokeOpacity=".3" strokeWidth="3" fill="none" />
    </svg>
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
