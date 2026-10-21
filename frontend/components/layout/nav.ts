import type * as React from 'react';
import { CubeIcon, DashboardIcon, StackIcon, TargetIcon } from '@radix-ui/react-icons';
import { Mic } from 'lucide-react';

export type NavIcon = React.ComponentType<{ className?: string }>;
export interface NavItem { label: string; to?: string; icon: NavIcon; children?: { label: string; to: string }[] }

export const NAV: (NavItem | 'divider')[] = [
  { label: 'Dashboard', to: '/', icon: DashboardIcon },
  { label: 'Uji Suara Mikrofon', to: '/live-test', icon: Mic },
  'divider',
  { label: 'Devices', icon: CubeIcon, children: [{ label: 'Device List', to: '/devices' }, { label: 'Add Device', to: '/devices/new' }] },
  { label: 'Data Batuk', icon: StackIcon, children: [
    { label: 'Data Batuk Web Form', to: '/data/webform' },
    { label: 'Naracoba Offline', to: '/data/offline' },
    { label: 'Data Batuk TB Primer', to: '/data/primer' },
  ] },
  'divider',
  { label: 'Pelacakan Pasien', to: '/patients', icon: TargetIcon },
];

/** item mana yang aktif untuk path ini */
export function isActive(item: NavItem, path: string) {
  if (item.to === '/') return path === '/';
  if (item.to) return path.startsWith(item.to);
  if (item.label === 'Devices') return path.startsWith('/devices') || path.startsWith('/detections');
  return !!item.children?.some((c) => path.startsWith(c.to));
}
