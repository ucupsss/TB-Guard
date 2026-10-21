'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, DotFilledIcon } from '@radix-ui/react-icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { NAV, isActive, type NavItem } from './nav';

function Group({ item, path, onNavigate }: { item: NavItem; path: string; onNavigate?: () => void }) {
  const active = isActive(item, path);
  const [open, setOpen] = React.useState(active);
  React.useEffect(() => { if (active) setOpen(true); }, [active]);
  const Icon = item.icon;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className={cn('side-menu w-full text-left pr-4', active && 'side-menu--active')}>
        <Icon className="mr-3 h-5 w-5 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        <ChevronDownIcon className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="side-sub mr-4 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        {item.children!.map((c) => (
          <Link key={c.to} href={c.to} onClick={onNavigate} className={cn(path === c.to && 'on')}>
            <DotFilledIcon className={cn('h-4 w-4 shrink-0', path !== c.to && 'opacity-50')} />
            <span className="truncate">{c.label}</span>
          </Link>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SideMenu({ onNavigate }: { onNavigate?: () => void; rail?: boolean }) {
  const pathname = usePathname() || '/';
  return (
    <nav aria-label="Menu utama" className="space-y-0.5">
      {NAV.map((item, i) => {
        if (item === 'divider') return <div key={i} className="my-5 mr-4 h-px bg-white/10" />;
        if (item.children) return <Group key={item.label} item={item} path={pathname} onNavigate={onNavigate} />;
        const Icon = item.icon;
        const active = isActive(item, pathname);
        return (
          <Link key={item.label} href={item.to!} onClick={onNavigate} className={cn('side-menu pr-4', active && 'side-menu--active')} aria-current={active ? 'page' : undefined}>
            <Icon className="mr-3 h-5 w-5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
