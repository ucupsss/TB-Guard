'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, DotFilledIcon } from '@radix-ui/react-icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { NAV, isActive, type NavItem } from './nav';

function Group({ item, path, rail, onNavigate }: { item: NavItem; path: string; rail?: boolean; onNavigate?: () => void }) {
  const active = isActive(item, path);
  const [open, setOpen] = React.useState(active);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- buka grup saat route berpindah ke dalamnya
  React.useEffect(() => { if (active) setOpen(true); }, [active]);
  const Icon = item.icon;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className={cn('side-menu w-full text-left', active && 'side-menu--active')}>
        <Icon className="mr-3 h-5 w-5 shrink-0" />
        <span className={cn('flex-1 whitespace-nowrap', rail && 'side-label')}>{item.label}</span>
        <ChevronDownIcon className={cn('mr-5 h-4 w-4 shrink-0 transition-transform', open && 'rotate-180', rail && 'side-label')} />
      </CollapsibleTrigger>
      {/* mode rel: sub-menu hanya tampil saat sidebar melebar */}
      <CollapsibleContent className={cn('side-sub mr-5 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down', rail && 'side-rail-sub')}>
        {item.children!.map((c) => (
          <Link key={c.to} href={c.to} onClick={onNavigate} className={cn(path === c.to && 'on')}>
            <DotFilledIcon className={cn('h-4 w-4 shrink-0', path !== c.to && 'opacity-50')} />
            <span className="whitespace-nowrap">{c.label}</span>
          </Link>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** `rail`: sidebar desktop yang hanya menampilkan ikon sampai di-hover */
export function SideMenu({ rail, onNavigate }: { rail?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() || '/';
  return (
    <nav aria-label="Menu utama">
      {NAV.map((item, i) => {
        if (item === 'divider') return <div key={i} className="my-6 mr-5 h-px bg-white/[0.08]" />;
        if (item.children) return <Group key={item.label} item={item} path={pathname} rail={rail} onNavigate={onNavigate} />;
        const Icon = item.icon;
        const active = isActive(item, pathname);
        return (
          <Link key={item.label} href={item.to!} onClick={onNavigate} className={cn('side-menu', active && 'side-menu--active')} aria-current={active ? 'page' : undefined}>
            <Icon className="mr-3 h-5 w-5 shrink-0" />
            <span className={cn('whitespace-nowrap', rail && 'side-label')}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
