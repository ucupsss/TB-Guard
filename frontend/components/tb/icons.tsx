import * as React from 'react';

/** ikon mikrofon bergaya @radix-ui/react-icons (15×15, garis 1px); Radix tidak menyediakannya */
export const MicIcon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function MicIcon({ className, ...props }, ref) {
  return (
    <svg ref={ref} width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" className={className} aria-hidden {...props}>
      <rect x="5" y="1.5" width="5" height="8" rx="2.5" /><path d="M3 7.5a4.5 4.5 0 0 0 9 0M7.5 12v1.5" />
    </svg>
  );
});
