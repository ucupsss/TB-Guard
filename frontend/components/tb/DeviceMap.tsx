'use client';

import * as React from 'react';
import type * as Leaflet from 'leaflet';
import type { Device, Detection } from '@/lib/types';

/** peta perangkat (Leaflet + OpenStreetMap/CARTO); penanda berisi jumlah batuk TB */
export function DeviceMap({ devices, detections, className }: { devices: Device[]; detections: Detection[]; className?: string }) {
  const el = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<Leaflet.Map | null>(null);
  const layer = React.useRef<Leaflet.LayerGroup | null>(null);
  const lib = React.useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = React.useState(false);

  // Leaflet menyentuh window, jadi dimuat di browser saja
  React.useEffect(() => {
    let alive = true;
    import('leaflet').then((mod) => {
    const L = (mod.default ?? mod) as typeof Leaflet;
    if (!alive || !el.current || map.current) return;
    lib.current = L;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([-7.272, 112.772], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    setReady(true);
    });
    return () => { alive = false; map.current?.remove(); map.current = null; };
  }, []);

  React.useEffect(() => {
    const L = lib.current;
    if (!ready || !L || !layer.current || !map.current) return;
    layer.current.clearLayers();
    const pts: Leaflet.LatLngExpression[] = [];
    devices.forEach((d) => {
      const tb = detections.filter((x) => x.deviceId === d.id && x.result === 'TB').length;
      const colour = d.status === 'active' ? '#1C3FAA' : d.status === 'inactive' ? '#F78B00' : '#D32929';
      const icon = L.divIcon({
        className: 'tb-marker',
        iconSize: [44, 44],
        html: `<div style="position:relative;width:44px;height:44px;display:grid;place-items:center">
          <span style="position:absolute;inset:0;border-radius:999px;background:${colour};opacity:.18"></span>
          <span style="position:absolute;inset:6px;border-radius:999px;background:${colour};opacity:.3"></span>
          <span style="position:relative;width:26px;height:26px;border-radius:999px;background:${colour};color:#fff;font:500 12px Roboto,sans-serif;display:grid;place-items:center;border:2px solid #fff">${tb}</span></div>`,
      });
      L.marker([d.lat, d.lng], { icon, title: d.name, keyboard: true })
        .bindPopup(`<b>${d.name}</b><br>${d.location} · ${d.zone}<br>${tb} batuk terindikasi TB<br><a href="/devices/${d.id}">Lihat perangkat →</a>`)
        .addTo(layer.current!);
      pts.push([d.lat, d.lng]);
    });
    if (pts.length > 1) map.current.fitBounds(L.latLngBounds(pts).pad(0.35));
    else if (pts.length === 1) map.current.setView(pts[0], 14);
  }, [devices, detections, ready]);

  return <div ref={el} className={className} role="region" aria-label="Peta perangkat" />;
}
