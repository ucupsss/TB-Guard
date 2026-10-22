'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Logo({
  className = 'h-8 w-8',
  tone = 'white',
  variant = 'icon',
}: {
  className?: string;
  tone?: 'white' | 'primary';
  variant?: 'icon' | 'full';
}) {
  if (variant === 'full') {
    return (
      <img
        src={tone === 'white' ? '/logo-panjang-white.png' : '/logo-panjang.png'}
        alt="TB Guard Agent"
        className={cn('shrink-0 object-contain', className)}
      />
    );
  }

  return (
    <img
      src="/logo-tbguard.png"
      alt="TB Guard Logo"
      className={cn('shrink-0 object-contain', className)}
    />
  );
}
