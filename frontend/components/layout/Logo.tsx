'use client';

export function Logo({ className = 'h-8 w-8', tone = 'white' }: { className?: string; tone?: 'white' | 'primary' }) {
  const fg = tone === 'white' ? '#ffffff' : 'hsl(var(--primary))';
  const bg = tone === 'white' ? 'hsl(var(--shell))' : '#ffffff';
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2.5 27.5 7v8.4c0 7.1-4.8 13-11.5 15.1C9.3 28.4 4.5 22.5 4.5 15.4V7z" fill={fg} />
      <g stroke={bg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M16 8v6.5" />
        <path d="M13.6 10.6c-3-.3-4.8 3.1-4.8 7.6 0 1.8 1 3 2.6 3 2 0 2.8-1.3 2.8-3.2V11.4" />
        <path d="M18.4 10.6c3-.3 4.8 3.1 4.8 7.6 0 1.8-1 3-2.6 3-2 0-2.8-1.3-2.8-3.2V11.4" />
      </g>
      <circle cx="16" cy="22" r="2" fill={bg} />
    </svg>
  );
}
