import { LayoutDashboard, Cpu, Database, Route, Mic, type LucideIcon } from 'lucide-react';

export interface NavItem { label: string; to?: string; icon: LucideIcon; children?: { label: string; to: string }[] }

export const NAV: (NavItem | 'divider')[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Uji Suara Mic (Live)', to: '/live-test', icon: Mic },
  'divider',
  { label: 'Devices', icon: Cpu, children: [{ label: 'Device List', to: '/devices' }, { label: 'Add Device', to: '/devices/new' }] },
  { label: 'Data Batuk', icon: Database, children: [
    { label: 'Data Batuk Web Form', to: '/data/webform' },
    { label: 'Naracoba Offline', to: '/data/offline' },
    { label: 'Data Batuk TB Primer', to: '/data/primer' },
  ] },
  'divider',
  { label: 'Pelacakan Pasien', to: '/patients', icon: Route },
];

/** item mana yang aktif untuk path ini */
export function isActive(item: NavItem, path: string) {
  if (item.to === '/') return path === '/';
  if (item.to) return path.startsWith(item.to);
  if (item.label === 'Devices') return path.startsWith('/devices') || path.startsWith('/detections');
  return !!item.children?.some((c) => path.startsWith(c.to));
}
