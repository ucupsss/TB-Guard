'use client';

import * as React from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StoreProvider } from '@/lib/store';
import { AgentProvider } from '@/components/agent/AgentProvider';
import { CommandPalette } from '@/components/agent/CommandPalette';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AgentProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          {/* usePathname di dalam palet perlu Suspense agar halaman dinamis tetap bisa di-prerender */}
          <React.Suspense fallback={null}><CommandPalette /></React.Suspense>
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </AgentProvider>
    </StoreProvider>
  );
}
