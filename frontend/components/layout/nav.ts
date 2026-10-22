import type * as React from 'react';
import { BarChartIcon, MixerHorizontalIcon, PersonIcon, CubeIcon, DashboardIcon, StackIcon, TargetIcon, Component1Icon, VideoIcon } from '@radix-ui/react-icons';
import { MicIcon } from '@/components/tb/icons';

export type NavIcon = React.ComponentType<{ className?: string }>;
export interface NavItem { label: string; to?: string; icon: NavIcon; adminOnly?: boolean; children?: { label: string; to: string }[] }

export const NAV: (NavItem | 'divider')[] = [
  { label: 'Dashboard', to: '/dashboard', icon: DashboardIcon },
  { label: 'Uji Suara Mikrofon', to: '/live-test', icon: MicIcon },
  { label: '3D Design', icon: Component1Icon, children: [
    { label: '3D Prototype', to: '/design' },
    { label: '3D Public Area', to: '/3d-public-area' },
  ] },
  { label: 'Peluang Pasar', icon: BarChartIcon, children: [
    { label: 'Potensi Pasar', to: '/market' },
    { label: 'Potensi Bisnis', to: '/market/business' },
  ] },
  { label: 'Orchestra AI', to: '/orchestra', icon: MixerHorizontalIcon },
  'divider',
  { label: 'Devices', icon: CubeIcon, children: [{ label: 'Device List', to: '/devices' }, { label: 'Add Device', to: '/devices/new' }] },
  { label: 'Data Batuk', icon: StackIcon, children: [
    { label: 'Data Batuk Web Form', to: '/data/webform' },
    { label: 'Naracoba Offline', to: '/data/offline' },
    { label: 'Data Batuk TB Primer', to: '/data/primer' },
  ] },
  'divider',
  { label: 'Pelacakan Pasien', to: '/patients', icon: TargetIcon },
  { label: 'Pengguna', to: '/users', icon: PersonIcon, adminOnly: true },
];

/** item mana yang aktif untuk path ini */
export function isActive(item: NavItem, path: string) {
  if (item.to === '/') return path === '/';
  if (item.to) return path.startsWith(item.to);
  if (item.label === 'Devices') return path.startsWith('/devices') || path.startsWith('/detections');
  return !!item.children?.some((c) => path.startsWith(c.to));
}
