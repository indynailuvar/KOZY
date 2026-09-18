import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Peta dasar: OpenStreetMap (tanpa API key). Untuk produksi, isi VITE_MAP_TILE_URL
// dengan penyedia tile berlisensi (mis. Stadia, MapTiler) — tile OSM publik tidak untuk trafik besar.
export const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE = TILE_URL;
const ATTR = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const svg = (d, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  lock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  unlock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 7.7-1.5"/>',
  grad: '<path d="M22 9 12 4 2 9l10 5 10-5z"/><path d="M6 11.2V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.8"/>',
  brief: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  hospital: '<path d="M3 21h18"/><path d="M5 21V8l7-4.5L19 8v13"/><path d="M12 9.5v5M9.5 12h5"/>',
  building: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M10.5 21v-3h3v3"/>',
  basket: '<path d="M4.5 10h15l-1.6 8.6a2 2 0 0 1-2 1.6H8.1a2 2 0 0 1-2-1.6z"/><path d="M9 10l3-5.5L15 10"/>',
  train: '<rect x="5.5" y="3" width="13" height="14" rx="3"/><path d="M5.5 10.5h13M9 21l-2-4M15 21l2-4"/>',
  school: '<path d="M3 10.5 12 5l9 5.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-4.5h4V20"/>',
  bus: '<rect x="4" y="3.5" width="16" height="14" rx="3"/><path d="M4 11h16M7.5 20.5v-3M16.5 20.5v-3"/>',
  pin: '<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function iconFor(m) {
  let html;
  if (m.kind === 'lock') {
    html = `<div class="mk-lock ${m.open ? 'is-open' : ''}"><span class="mk-lock-ic">${svg(ICON[m.open ? 'unlock' : 'lock'], 20)}</span><b>${esc(m.label)}</b></div>`;
  } else if (m.kind === 'price') {
    html = `<div class="mk-price ${m.selected ? 'is-sel' : ''}">${esc(m.label)}</div>`;
  } else if (m.kind === 'pin') {
    html = `<div class="mk-pin"><span>${svg(ICON.home, 18)}</span></div>`;
  } else if (m.kind === 'area') {
    html = `<div class="mk-area ${m.selected ? 'is-sel' : ''}">${m.selected ? svg(ICON.lock, 13) : ''}${esc(m.label)}</div>`;
  } else {
    html = `<div class="mk-place" title="${esc(m.label)}"><span>${svg(ICON[m.icon || 'grad'], 18)}</span><b>${esc(m.label)}</b></div>`;
  }
  return L.divIcon({ className: 'kmk', html, iconSize: null });
}

export default function KozyMap({
  center,
  zoom = 15,
  markers = [],
  circle = null,
  onSelect,
  focus = null,
  fitKey = null,
  interactive = true,
  padBottom = 48,
  className = '',
  children,
}) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const onSel = useRef(onSelect);
  onSel.current = onSelect;

  useEffect(() => {
    const m = L.map(el.current, {
      center,
      zoom,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: interactive || !L.Browser.mobile,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: false,
      keyboard: interactive,
    });
    L.tileLayer(TILE, { maxZoom: 19, attribution: ATTR }).addTo(m);
    m.attributionControl.setPrefix(false);
    if (interactive) L.control.zoom({ position: 'topright' }).addTo(m);
    // scroll-zoom hanya setelah peta diklik, agar halaman tetap bisa di-scroll
    m.on('click', () => m.scrollWheelZoom.enable());
    m.on('mouseout', () => m.scrollWheelZoom.disable());
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markerKey = JSON.stringify(markers);
  const circleKey = JSON.stringify(circle);
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    if (circle) {
      L.circle([circle.lat, circle.lng], {
        radius: circle.radius,
        color: '#1D4ED8',
        weight: 1.5,
        dashArray: '5 6',
        fillColor: '#1D4ED8',
        fillOpacity: 0.07,
        interactive: false,
      }).addTo(g);
    }
    for (const mk of markers) {
      const marker = L.marker([mk.lat, mk.lng], {
        icon: iconFor(mk),
        zIndexOffset: mk.selected ? 1000 : mk.kind === 'place' ? -100 : 0,
        title: mk.title || mk.label,
        alt: mk.title || mk.label,
        keyboard: !!mk.id,
        interactive: !!mk.id || mk.kind === 'lock',
      });
      if (mk.id || mk.kind === 'lock') marker.on('click', () => onSel.current?.(mk.id || 'lock'));
      marker.addTo(g);
    }
  }, [markerKey, circleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m || fitKey == null) return;
    const pts = markers.map((x) => [x.lat, x.lng]);
    if (pts.length > 1) m.fitBounds(pts, { paddingTopLeft: [40, 60], paddingBottomRight: [40, padBottom], maxZoom: 16 });
    else if (pts.length === 1) m.setView(pts[0], zoom);
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m || !focus) return;
    // geser supaya pin terpilih tidak tertutup kartu detail di bawah peta
    const target = m.project([focus.lat, focus.lng], m.getZoom()).add([0, focus.offsetY || 0]);
    m.panTo(m.unproject(target, m.getZoom()), { animate: true, duration: 0.35 });
  }, [focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`kmap ${className}`}>
      <div ref={el} className="kmap-canvas" />
      {children}
    </div>
  );
}
