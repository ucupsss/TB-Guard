'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Logo({
  className = 'h-8 w-8',
  tone = 'white',
}: {
  className?: string;
  tone?: 'white' | 'primary';
}) {
  return (
    <img
      src="/logo-tbguard.png"
      alt="TB Guard Logo"
      className={cn('shrink-0 object-contain', className)}
    />
  );
}
