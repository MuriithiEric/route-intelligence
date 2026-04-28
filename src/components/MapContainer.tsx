import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  MapContainer as LeafletMap,
  TileLayer,
  CircleMarker,
  Marker,
  Polyline,
  Tooltip,
  Popup,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L, { type LatLngExpression, type LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

import { useAppContext, useLayers } from '../context/AppContext';
import { useMapData } from '../hooks/useMapData';
import type { TTMSummary, Customer, Visit, RouteSummary } from '../types';
import { GROUP_COLOURS } from '../types';
import CustomerUniverseLayer from './map/CustomerUniverseLayer';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapContainerProps {
  ttmSummary: TTMSummary[];
  routeSummary: RouteSummary[];
}

// Per-cat colours for the customer universe layer
const CUSTOMER_COLOURS: Record<string, string> = {
  DISTRIBUTOR: '#C0392B',
  'KEY ACCOUNT': '#7E57C2',
  HUB: '#C9963E',
  STOCKIST: '#E07B39',
  SUPERMARKET: '#0E8C7A',
  'GENERAL TRADE': '#9E9E9E',
  'DISTRIBUTOR - FEEDS': '#E88080',
};

function normalizeCat(cat: string): string {
  const c = (cat || '').toUpperCase().trim();
  if (c === 'DISTRIBUTOR') return 'DISTRIBUTOR';
  if (c === 'DISTRIBUTOR - FEEDS') return 'DISTRIBUTOR - FEEDS';
  if (c === 'KEY ACCOUNT') return 'KEY ACCOUNT';
  if (c === 'HUB') return 'HUB';
  if (c === 'STOCKIST') return 'STOCKIST';
  if (c === 'SUPERMARKET' || c === 'MODERN TRADE') return 'SUPERMARKET';
  return 'GENERAL TRADE';
}

function useDebounce(fn: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(), delay);
  }, [delay]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Universe Layer — viewport-bounded, multi-tier, visited/unvisited
// ─────────────────────────────────────────────────────────────────────────────
function _LegacyCustomerUniverseLayer({
  activeTier,
  tierVisibility,
}: {
  activeTier: string | null;
  tierVisibility: Record<string, boolean>;
}) {
  const { fetchCustomersInBounds } = useMapData();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const map = useMap();

  const loadCustomers = useCallback(async () => {
    const zoom = map.getZoom();
    const minZoom = activeTier ? 7 : 9;
    if (zoom < minZoom) { setCustomers([]); return; }

    const bounds = map.getBounds();
    try {
      // Server-side single-tier filter when only one tier is selected; else fetch all
      const data = await fetchCustomersInBounds({
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      }, activeTier);
      setCustomers(data);
    } catch (err) {
      console.error('CustomerUniverseLayer load error:', err);
    }
  }, [map, fetchCustomersInBounds, activeTier]);

  const debouncedLoad = useDebounce(loadCustomers, 500);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useMapEvents({ moveend: debouncedLoad, zoomend: debouncedLoad });

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <MarkerClusterGroup chunkedLoading>
      {customers.map(c => {
        if (!c.lat || !c.lng) return null;

        const normalized = normalizeCat(c.cat);

        // Client-side tier visibility filter
        if (!(tierVisibility[normalized] ?? true)) return null;

        const color = CUSTOMER_COLOURS[normalized] || '#9E9E9E';
        const isVisited = !!c.last_visit;

        const radius = normalized === 'DISTRIBUTOR' ? 8
          : normalized === 'KEY ACCOUNT' ? 6
          : normalized === 'HUB' ? 6
          : normalized === 'SUPERMARKET' ? 5
          : normalized === 'STOCKIST' ? 4
          : 3;

        const pathOptions = isVisited
          ? { color, fillColor: color, fillOpacity: 0.82, weight: 1 }
          : { color, fillColor: '#FFFFFF', fillOpacity: 0.9, weight: 1.5, dashArray: '4 3' };

        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng] as LatLngTuple}
            radius={radius}
            pathOptions={pathOptions}
          >
            <Tooltip direction="top" offset={[0, -radius]}>
              <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 }}>
                {c.name} · {c.region}
                {!isVisited && ' · Never visited'}
              </span>
            </Tooltip>
            <Popup minWidth={200} maxWidth={260}>
              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 0' }}>
                <div style={{ fontWeight: 700, color: '#1E3A5F', fontSize: 13, marginBottom: 4 }}>{c.name}</div>
                <div style={{ marginBottom: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ background: color, color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>
                    {c.cat}
                  </span>
                  {!isVisited && (
                    <span style={{ background: '#FEF2F2', color: '#EF4444', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>
                      Never visited
                    </span>
                  )}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    {c.region && <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Region</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.region}</td></tr>}
                    {c.territory && <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Territory</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.territory}</td></tr>}
                    {c.channel && <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Channel</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.channel}</td></tr>}
                    {c.loc && <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Location</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.loc}</td></tr>}
                    <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Last visit</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{formatDate(c.last_visit)}</td></tr>
                    {c.last_sale && <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Last sale</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{formatDate(c.last_sale)}</td></tr>}
                    {c.phone && <tr><td style={{ color: '#6B7280', paddingRight: 8 }}>Phone</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.phone}</td></tr>}
                  </tbody>
                </table>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MarkerClusterGroup>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rep Visited Shops Layer (all-time, no date filter)
// ─────────────────────────────────────────────────────────────────────────────
function RepVisitedShopsLayer({ visits, repColor }: { visits: Visit[]; repColor: string }) {
  if (visits.length === 0) return null;

  const shopMap = visits.reduce<Record<string, {
    shop_id: string; shop_name: string; lat: number; lng: number;
    region: string; visit_count: number; last_visit: string; route_name: string;
  }>>((acc, v) => {
    if (!v.lat || !v.lng) return acc;
    if (!acc[v.shop_id]) {
      acc[v.shop_id] = { shop_id: v.shop_id, shop_name: v.shop_name, lat: v.lat, lng: v.lng, region: v.region, visit_count: 0, last_visit: v.check_in, route_name: v.route_name };
    }
    acc[v.shop_id].visit_count += 1;
    if (v.check_in > acc[v.shop_id].last_visit) acc[v.shop_id].last_visit = v.check_in;
    return acc;
  }, {});

  const shops = Object.values(shopMap);
  const maxVisits = Math.max(...shops.map(s => s.visit_count), 1);
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <>
      {shops.map(shop => {
        const radius = 6 + Math.round((shop.visit_count / maxVisits) * 8);
        const fillOpacity = 0.5 + (shop.visit_count / maxVisits) * 0.45;
        return (
          <CircleMarker
            key={shop.shop_id}
            center={[shop.lat, shop.lng] as LatLngTuple}
            radius={radius}
            pathOptions={{ color: '#FFFFFF', weight: 1.5, fillColor: repColor, fillOpacity }}
          >
            <Tooltip direction="top" offset={[0, -radius]}>
              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', minWidth: 160 }}>
                <div style={{ fontWeight: 700, color: '#1E3A5F', fontSize: 12 }}>{shop.shop_name}</div>
                <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{shop.region}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, gap: 12 }}>
                  <span style={{ color: repColor, fontWeight: 700, fontSize: 11 }}>{shop.visit_count}× visited</span>
                  <span style={{ color: '#9CA3AF', fontSize: 10 }}>Last: {formatDate(shop.last_visit)}</span>
                </div>
                {shop.route_name && <div style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2 }}>Route: {shop.route_name}</div>}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Route Layer — chronological path for a date-filtered set of visits
// ─────────────────────────────────────────────────────────────────────────────
function getBearing(p1: LatLngTuple, p2: LatLngTuple): number {
  const lat1 = p1[0] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180;
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function makeArrowIcon(bearing: number, color: string) {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${bearing - 90}deg)">
        <polygon points="14,7 2,12 5,7 2,2" fill="${color}" opacity="0.85"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function makeFlagIcon(label: string, bg: string) {
  return L.divIcon({
    html: `<div style="background:${bg};color:#fff;font-family:Inter,system-ui,sans-serif;font-size:10px;font-weight:700;width:20px;height:20px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${label}</div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function DayRouteLayer({ visits, repColor }: { visits: Visit[]; repColor: string }) {
  const ordered = useMemo(() => [...visits].sort((a, b) => (a.check_in || '').localeCompare(b.check_in || '')), [visits]);
  const pts = useMemo(() => ordered.filter(v => v.lat && v.lng).map(v => [v.lat, v.lng] as LatLngTuple), [ordered]);

  if (pts.length === 0) return null;

  const formatTime = (d: string) => d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';

  // Place one arrow every ~3 segments, up to 8 arrows total
  const step = Math.max(1, Math.floor(pts.length / Math.min(8, pts.length)));
  const arrows: Array<{ pos: LatLngTuple; bearing: number }> = [];
  for (let i = 0; i < pts.length - 1; i += step) {
    const p1 = pts[i], p2 = pts[i + 1];
    arrows.push({
      pos: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2],
      bearing: getBearing(p1, p2),
    });
  }

  const startVisit = ordered.find(v => v.lat && v.lng);
  const endVisit = [...ordered].reverse().find(v => v.lat && v.lng);

  return (
    <>
      {/* Chronological route polyline */}
      {pts.length >= 2 && (
        <Polyline
          positions={pts}
          pathOptions={{ color: repColor, weight: 3.5, opacity: 0.85 }}
        />
      )}

      {/* Direction arrow markers */}
      {arrows.map((a, i) => (
        <Marker
          key={`arrow-${i}`}
          position={a.pos}
          icon={makeArrowIcon(a.bearing, repColor)}
          interactive={false}
        />
      ))}

      {/* Start marker (green) */}
      {startVisit && (
        <Marker
          position={[startVisit.lat, startVisit.lng] as LatLngTuple}
          icon={makeFlagIcon('S', '#16A34A')}
          zIndexOffset={500}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 }}>
              Start · {formatTime(startVisit.check_in)}
            </span>
          </Tooltip>
        </Marker>
      )}

      {/* End marker (red) */}
      {endVisit && endVisit.id !== startVisit?.id && (
        <Marker
          position={[endVisit.lat, endVisit.lng] as LatLngTuple}
          icon={makeFlagIcon('E', '#DC2626')}
          zIndexOffset={500}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 }}>
              End · {formatTime(endVisit.check_in)}
            </span>
          </Tooltip>
        </Marker>
      )}

      {/* Individual visit dots with popup */}
      {ordered.filter(v => v.lat && v.lng).map((v, i) => (
        <CircleMarker
          key={`dv-${v.id}-${i}`}
          center={[v.lat, v.lng] as LatLngTuple}
          radius={6}
          pathOptions={{ color: '#FFFFFF', weight: 1.5, fillColor: repColor, fillOpacity: 0.9 }}
        >
          <Popup minWidth={180} maxWidth={220}>
            <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#1E3A5F', marginBottom: 2 }}>{v.shop_name}</div>
              <div style={{ color: '#6B7280', fontSize: 11 }}>{v.region}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                <span>🕐 {formatTime(v.check_in)}</span>
                {v.duration ? <span>⏱ {v.duration} min</span> : null}
              </div>
              {v.route_name && <div style={{ color: '#9CA3AF', fontSize: 10, marginTop: 3 }}>Route: {v.route_name}</div>}
            </div>
          </Popup>
          <Tooltip direction="top" offset={[0, -6]}>
            <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 }}>
              #{i + 1} · {v.shop_name} · {formatTime(v.check_in)}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Neighbourhood Layer — unvisited customers in the route corridor
// ─────────────────────────────────────────────────────────────────────────────
function RouteNeighbourhoodLayer({
  dateVisits,
  onLoad,
}: {
  dateVisits: Visit[];
  onLoad?: (count: number) => void;
}) {
  const { fetchCustomersInBounds } = useMapData();
  const [unvisitedNearby, setUnvisitedNearby] = useState<Customer[]>([]);

  const visitedIds = useMemo(
    () => new Set(dateVisits.map(v => v.shop_id).filter(Boolean)),
    [dateVisits]
  );

  useEffect(() => {
    if (dateVisits.length === 0) { setUnvisitedNearby([]); onLoad?.(0); return; }
    const pts = dateVisits.filter(v => v.lat && v.lng);
    if (pts.length === 0) { setUnvisitedNearby([]); onLoad?.(0); return; }

    const PAD = 0.05; // ~5 km corridor padding
    const bbox = {
      minLat: Math.min(...pts.map(v => v.lat)) - PAD,
      maxLat: Math.max(...pts.map(v => v.lat)) + PAD,
      minLng: Math.min(...pts.map(v => v.lng)) - PAD,
      maxLng: Math.max(...pts.map(v => v.lng)) + PAD,
    };

    fetchCustomersInBounds(bbox, null)
      .then(data => {
        const unvisited = data.filter(c => !visitedIds.has(c.id));
        setUnvisitedNearby(unvisited);
        onLoad?.(unvisited.length);
      })
      .catch(console.error);
  }, [dateVisits, fetchCustomersInBounds, visitedIds, onLoad]);

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
      {unvisitedNearby.map(c => {
        if (!c.lat || !c.lng) return null;
        const normalized = normalizeCat(c.cat);
        const color = CUSTOMER_COLOURS[normalized] || '#9E9E9E';
        const radius = normalized === 'DISTRIBUTOR' ? 7
          : normalized === 'KEY ACCOUNT' ? 6
          : normalized === 'HUB' ? 5
          : 4;
        return (
          <CircleMarker
            key={`rn-${c.id}`}
            center={[c.lat, c.lng] as LatLngTuple}
            radius={radius}
            pathOptions={{ color, fillColor: '#FFFFFF', fillOpacity: 0.9, weight: 1.5, dashArray: '4 3' }}
          >
            <Tooltip direction="top" offset={[0, -radius]}>
              <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 }}>
                {c.name} · {c.cat} · Not visited this day
              </span>
            </Tooltip>
            <Popup minWidth={200} maxWidth={260}>
              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 0' }}>
                <div style={{ fontWeight: 700, color: '#1E3A5F', fontSize: 13, marginBottom: 4 }}>{c.name}</div>
                <div style={{ marginBottom: 6, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ background: color, color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>{c.cat}</span>
                  <span style={{ background: '#FEF2F2', color: '#EF4444', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>Not visited this day</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    {c.region && <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Region</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.region}</td></tr>}
                    {c.territory && <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Territory</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.territory}</td></tr>}
                    {c.channel && <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Channel</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.channel}</td></tr>}
                    <tr><td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Last visit</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{formatDate(c.last_visit)}</td></tr>
                    {c.phone && <tr><td style={{ color: '#6B7280', paddingRight: 8 }}>Phone</td><td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.phone}</td></tr>}
                  </tbody>
                </table>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MarkerClusterGroup>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// All-time route lines per route_id
// ─────────────────────────────────────────────────────────────────────────────
function RoutesLayer({ repName, visits, repColor }: { repName: string | null; visits: Visit[]; repColor: string }) {
  if (!repName || visits.length === 0) return null;

  const routeGroups = visits.reduce<Record<string, Visit[]>>((acc, v) => {
    if (!acc[v.route_id]) acc[v.route_id] = [];
    acc[v.route_id].push(v);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(routeGroups).map(([routeId, routeVisits]) => {
        const sorted = [...routeVisits].sort((a, b) => (a.check_in || '').localeCompare(b.check_in || ''));
        const points = sorted.filter(v => v.lat && v.lng).map(v => [v.lat, v.lng] as LatLngTuple);
        if (points.length < 2) return null;
        return (
          <Polyline key={routeId} positions={points} pathOptions={{ color: repColor, weight: 2.5, opacity: 0.55 }}>
            <Tooltip sticky>
              <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 }}>
                {routeVisits[0]?.route_name || routeId} · {routeVisits.length} stops
              </span>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unvisited Outlets Layer — customers with last_visit IS NULL
// ─────────────────────────────────────────────────────────────────────────────
function UnvisitedLayer() {
  const { fetchUnvisitedInBounds } = useMapData();
  const [unvisited, setUnvisited] = useState<Customer[]>([]);
  const map = useMap();

  const load = useCallback(async () => {
    const zoom = map.getZoom();
    if (zoom < 9) { setUnvisited([]); return; }
    const bounds = map.getBounds();
    try {
      const data = await fetchUnvisitedInBounds({
        minLat: bounds.getSouth(), maxLat: bounds.getNorth(),
        minLng: bounds.getWest(), maxLng: bounds.getEast(),
      });
      setUnvisited(data);
    } catch (err) {
      console.error('UnvisitedLayer error:', err);
    }
  }, [map, fetchUnvisitedInBounds]);

  const debouncedLoad = useDebounce(load, 600);
  useEffect(() => { load(); }, [load]);
  useMapEvents({ moveend: debouncedLoad, zoomend: debouncedLoad });

  return (
    <MarkerClusterGroup chunkedLoading>
      {unvisited.map(c => {
        if (!c.lat || !c.lng) return null;
        return (
          <CircleMarker
            key={`unv-${c.id}`}
            center={[c.lat, c.lng] as LatLngTuple}
            radius={4}
            pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.25, weight: 1 }}
          >
            <Tooltip direction="top">
              <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 }}>
                {c.name} · {c.cat} · Never visited
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MarkerClusterGroup>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field Staff Markers
// ─────────────────────────────────────────────────────────────────────────────
const REGION_CENTROIDS: Record<string, LatLngTuple> = {
  NAIROBI: [-1.286, 36.818],
  'NORTH RIFT': [0.519, 35.271],
  'SOUTH RIFT': [-0.905, 36.065],
  CENTRAL: [-0.304, 36.886],
  LAKE: [-0.102, 34.754],
  COAST: [-3.217, 40.117],
};

function resolveRegionCentroid(primaryRegion: string): LatLngTuple {
  const region = (primaryRegion || 'NAIROBI').toUpperCase().trim();
  if (REGION_CENTROIDS[region]) return REGION_CENTROIDS[region];
  const key = Object.keys(REGION_CENTROIDS).find(k => region.includes(k) || k.includes(region));
  return key ? REGION_CENTROIDS[key] : REGION_CENTROIDS.NAIROBI;
}

function FieldStaffLayer({ ttmSummary, onRepClick, zoom }: {
  ttmSummary: TTMSummary[];
  onRepClick: (rep: TTMSummary) => void;
  zoom: number;
}) {
  const { selectedRep } = useAppContext();

  const sorted = [...ttmSummary].sort((a, b) => {
    const aInactive = a.rep_status === 'Inactive' ? 0 : 1;
    const bInactive = b.rep_status === 'Inactive' ? 0 : 1;
    return aInactive - bInactive;
  });

  return (
    <MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
      {sorted.map(rep => {
        const centroid = resolveRegionCentroid(rep.primary_region);
        const idStr = String(rep.id ?? '0000');
        const idNum = parseInt(idStr.replace(/[^0-9]/g, '').slice(-4) || '0', 10);
        const jitterLat = ((idNum % 100) - 50) * 0.004;
        const jitterLng = (Math.floor(idNum / 100) % 100 - 50) * 0.004;
        const pos: LatLngTuple = [centroid[0] + jitterLat, centroid[1] + jitterLng];
        const isInactive = rep.rep_status === 'Inactive';
        const groupColor = GROUP_COLOURS[rep.role] || '#6B7280';
        const markerColor = isInactive ? '#9E9E9E' : groupColor;
        const isSelected = selectedRep === rep.raw_name;

        return (
          <CircleMarker
            key={`rep-${rep.id}-${rep.name}`}
            center={pos}
            radius={isSelected ? 14 : 10}
            pathOptions={{
              color: isSelected ? '#C9963E' : markerColor,
              fillColor: markerColor,
              fillOpacity: isInactive ? 0.35 : 0.9,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => onRepClick(rep) }}
          >
            {zoom >= 8 && (
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span style={{ fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {rep.name?.split(' ')[0]}
                </span>
              </Tooltip>
            )}
            <Tooltip direction="top" offset={[0, -12]}>
              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', minWidth: 140 }}>
                <strong style={{ color: '#1E3A5F' }}>{rep.name}</strong><br />
                <span style={{ color: '#6B7280', fontSize: 11 }}>{rep.role} · {rep.primary_region}</span><br />
                <span style={{ color: '#9CA3AF', fontSize: 10 }}>{rep.total_visits?.toLocaleString()} visits</span>
                {isInactive && <><br /><span style={{ color: '#9E9E9E', fontSize: 10 }}>● Inactive</span></>}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MarkerClusterGroup>
  );
}

function MapEventListener({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({ zoomend: (e) => onZoomChange(e.target.getZoom()) });
  return null;
}

// Fly-to controller — handles rep select, tier activate, and distributor-region clicks
function MapFlyController({ ttmSummary, dateVisits, hasDateFilter }: {
  ttmSummary: TTMSummary[];
  dateVisits: Visit[];
  hasDateFilter: boolean;
}) {
  const { selectedRep, filters, mapFlyTo, setMapFlyTo } = useAppContext();
  const map = useMap();
  const prevRep = useRef<string | null>(null);
  const prevTier = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedRep || selectedRep === prevRep.current) return;
    prevRep.current = selectedRep;
    const rep = ttmSummary.find(r => r.raw_name === selectedRep);
    if (!rep) return;
    const center = resolveRegionCentroid(rep.primary_region);
    map.flyTo(center, 10, { duration: 1.2, easeLinearity: 0.4 });
  }, [selectedRep, ttmSummary, map]);

  useEffect(() => { if (!selectedRep) prevRep.current = null; }, [selectedRep]);

  // When date-filtered visits arrive, fit map to their bounding box
  useEffect(() => {
    if (!hasDateFilter || dateVisits.length === 0) return;
    const pts = dateVisits.filter(v => v.lat && v.lng);
    if (pts.length === 0) return;
    const lats = pts.map(v => v.lat);
    const lngs = pts.map(v => v.lng);
    const bounds = L.latLngBounds(
      [Math.min(...lats) - 0.02, Math.min(...lngs) - 0.02],
      [Math.max(...lats) + 0.02, Math.max(...lngs) + 0.02]
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
  }, [dateVisits, hasDateFilter, map]);

  useEffect(() => {
    if (!filters.activeTier || filters.activeTier === prevTier.current) return;
    prevTier.current = filters.activeTier;
    if (map.getZoom() < 9) map.flyTo(map.getCenter(), 9, { duration: 0.9, easeLinearity: 0.4 });
  }, [filters.activeTier, map]);

  useEffect(() => { if (!filters.activeTier) prevTier.current = null; }, [filters.activeTier]);

  useEffect(() => {
    if (!mapFlyTo) return;
    map.flyTo([mapFlyTo.lat, mapFlyTo.lng], mapFlyTo.zoom, { duration: 1.4, easeLinearity: 0.35 });
    setMapFlyTo(null);
  }, [mapFlyTo, map, setMapFlyTo]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MapContainer
// ─────────────────────────────────────────────────────────────────────────────
export default function MapContainer({ ttmSummary }: MapContainerProps) {
  const { selectedRep, setSelectedRep, repDateFrom, repDateTo } = useAppContext();
  const { layers } = useLayers();
  const { fetchRepVisits, fetchRepVisitsForDateRange } = useMapData();
  const [repVisits, setRepVisits] = useState<Visit[]>([]);
  const [dateVisits, setDateVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [zoom, setZoom] = useState(7);
  const [nearbyUnvisitedCount, setNearbyUnvisitedCount] = useState(0);
  const [universeCount, setUniverseCount] = useState<number | null>(null);

  const repColor = useMemo(() => {
    if (!selectedRep) return '#C9963E';
    const rep = ttmSummary.find(r => r.raw_name === selectedRep);
    return GROUP_COLOURS[rep?.role || ''] || '#C9963E';
  }, [selectedRep, ttmSummary]);

  const repStats = useMemo(
    () => ttmSummary.find(r => r.raw_name === selectedRep) ?? null,
    [ttmSummary, selectedRep]
  );

  const hasDateFilter = !!(repDateFrom && repDateTo);

  // Load all-time visits (for all-time route + shop layers)
  useEffect(() => {
    if (selectedRep) {
      setVisitsLoading(true);
      fetchRepVisits(selectedRep)
        .then(setRepVisits)
        .catch(console.error)
        .finally(() => setVisitsLoading(false));
    } else {
      setRepVisits([]);
      setDateVisits([]);
    }
  }, [selectedRep, fetchRepVisits]);

  // Load date-filtered visits when date range is set
  useEffect(() => {
    if (selectedRep && repDateFrom && repDateTo) {
      fetchRepVisitsForDateRange(selectedRep, repDateFrom, repDateTo)
        .then(setDateVisits)
        .catch(console.error);
    } else {
      setDateVisits([]);
      setNearbyUnvisitedCount(0);
    }
  }, [selectedRep, repDateFrom, repDateTo, fetchRepVisitsForDateRange]);

  // Reset universe count when layer is toggled off
  useEffect(() => {
    if (!layers.customerUniverse) setUniverseCount(null);
  }, [layers.customerUniverse]);

  const handleRepClick = useCallback((rep: TTMSummary) => {
    setSelectedRep(selectedRep === rep.raw_name ? null : rep.raw_name);
  }, [selectedRep, setSelectedRep]);

  const CENTER: LatLngExpression = [0.0236, 37.9062];

  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
      {/* Rep info badge */}
      {selectedRep && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: repColor, color: '#FFFFFF',
          padding: '6px 10px 6px 14px', borderRadius: 24, fontSize: 12,
          fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 2px 12px rgba(0,0,0,0.28)', display: 'flex',
          alignItems: 'center', gap: 6, whiteSpace: 'nowrap', pointerEvents: 'all',
        }}>
          {visitsLoading ? (
            <span style={{ opacity: 0.85 }}>Loading {repStats?.name ?? selectedRep}…</span>
          ) : (
            <>
              <span>{repStats?.name ?? selectedRep}</span>
              {repStats?.role && <><span style={{ opacity: 0.4 }}>·</span><span style={{ fontWeight: 500, opacity: 0.85, fontSize: 11 }}>{repStats.role}</span></>}
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ fontWeight: 400, opacity: 0.9 }}>{repStats?.unique_shops?.toLocaleString() ?? '—'} shops</span>
              {hasDateFilter && (
                <><span style={{ opacity: 0.4 }}>·</span>
                <span style={{ fontWeight: 400, opacity: 0.9, fontSize: 11 }}>
                  {repDateFrom === repDateTo ? repDateFrom : `${repDateFrom} → ${repDateTo}`}
                  {' '}· {dateVisits.length} visited
                </span>
                {nearbyUnvisitedCount > 0 && (
                  <><span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ fontWeight: 500, fontSize: 11, opacity: 0.9, color: '#FCA5A5' }}>
                    {nearbyUnvisitedCount} nearby unvisited
                  </span></>
                )}
                </>
              )}
            </>
          )}
          <button
            onClick={() => setSelectedRep(null)}
            style={{
              marginLeft: 4, background: 'rgba(255,255,255,0.22)', border: 'none',
              borderRadius: '50%', width: 20, height: 20, cursor: 'pointer',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0,
            }}
          >×</button>
        </div>
      )}

      {/* Route mode legend */}
      {selectedRep && hasDateFilter && (
        <div style={{
          position: 'absolute', bottom: 96, left: 12, zIndex: 1000,
          background: 'rgba(255,255,255,0.96)', borderRadius: 8, padding: '8px 10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.14)', border: '1px solid rgba(0,0,0,0.08)',
          fontFamily: 'Inter, system-ui, sans-serif', pointerEvents: 'none', minWidth: 150,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Route Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: repColor, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#374151' }}>Visited this period</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px dashed #EF4444', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#374151' }}>Nearby — not visited</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 2, background: repColor, display: 'inline-block', flexShrink: 0, borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: '#374151' }}>Route line</span>
            </div>
          </div>
        </div>
      )}

      {/* Map legend */}
      {layers.customerUniverse && !hasDateFilter && (
        <div style={{
          position: 'absolute', bottom: 96, left: 12, zIndex: 1000,
          background: 'rgba(255,255,255,0.96)', borderRadius: 8, padding: '8px 10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.14)', border: '1px solid rgba(0,0,0,0.08)',
          fontFamily: 'Inter, system-ui, sans-serif', pointerEvents: 'none', minWidth: 130,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Map Legend
          </div>
          {Object.entries(CUSTOMER_COLOURS).map(([key, color]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#374151' }}>
                {key === 'SUPERMARKET' ? 'Modern Trade' : key === 'GENERAL TRADE' ? 'General Trade' : key === 'DISTRIBUTOR - FEEDS' ? 'Dist. Feeds' : key.charAt(0) + key.slice(1).toLowerCase()}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 4, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#9CA3AF', display: 'inline-block' }} />
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>Visited</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px dashed #9CA3AF', display: 'inline-block' }} />
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>Never visited</span>
            </div>
          </div>
        </div>
      )}

      {/* Outlet count badge — bottom-left, above layers panel */}
      {layers.customerUniverse && (
        <div style={{
          position: 'absolute', bottom: 48, left: 12, zIndex: 1001,
          background: 'rgba(255,255,255,0.96)', borderRadius: 6,
          padding: '4px 10px', fontSize: 11, fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif', color: '#1E3A5F',
          boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
          border: '1px solid rgba(0,0,0,0.08)', pointerEvents: 'none',
        }}>
          {universeCount === null ? 'Loading outlets…' : `${universeCount.toLocaleString()} outlets`}
        </div>
      )}

      <LeafletMap center={CENTER} zoom={7} style={{ width: '100%', height: '100%' }} zoomControl preferCanvas>
        {/* CartoDB light basemap when customer universe is on — makes colored dots pop */}
        {layers.customerUniverse ? (
          <TileLayer
            key="carto-light"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            key="osm"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
        )}

        <MapEventListener onZoomChange={setZoom} />
        <MapFlyController ttmSummary={ttmSummary} dateVisits={dateVisits} hasDateFilter={hasDateFilter} />

        {layers.fieldStaff && (
          <FieldStaffLayer ttmSummary={ttmSummary} onRepClick={handleRepClick} zoom={zoom} />
        )}

        {layers.customerUniverse && (
          <CustomerUniverseLayer
            activeTier={layers.customerTier}
            tierVisibility={layers.tierVisibility}
            onCountChange={count => { setUniverseCount(count); }}
          />
        )}

        {/* All-time route + shop layers — only when no date filter */}
        {selectedRep && !hasDateFilter && (
          <RoutesLayer repName={selectedRep} visits={repVisits} repColor={repColor} />
        )}
        {selectedRep && !hasDateFilter && repVisits.length > 0 && (
          <RepVisitedShopsLayer visits={repVisits} repColor={repColor} />
        )}

        {/* Date-filtered day route — replaces all-time layers when date is set */}
        {selectedRep && hasDateFilter && (
          <DayRouteLayer visits={dateVisits} repColor={repColor} />
        )}

        {/* Unvisited customers in route corridor */}
        {selectedRep && hasDateFilter && dateVisits.length > 0 && (
          <RouteNeighbourhoodLayer dateVisits={dateVisits} onLoad={setNearbyUnvisitedCount} />
        )}

        {/* Unvisited outlets layer */}
        {layers.showUnvisited && <UnvisitedLayer />}
      </LeafletMap>
    </div>
  );
}
