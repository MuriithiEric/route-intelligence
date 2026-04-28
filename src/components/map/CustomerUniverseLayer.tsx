import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { supabase } from '../../lib/supabase';

// ─── Color map (mirrors MapContainer CUSTOMER_COLOURS) ───────────────────────
const COLOURS: Record<string, string> = {
  DISTRIBUTOR: '#C0392B',
  'KEY ACCOUNT': '#7E57C2',
  HUB: '#C9963E',
  STOCKIST: '#E07B39',
  SUPERMARKET: '#0E8C7A',
  'GENERAL TRADE': '#9E9E9E',
  'DISTRIBUTOR - FEEDS': '#E88080',
};

function normCat(cat: string): string {
  const c = (cat || '').toUpperCase().trim();
  if (c === 'DISTRIBUTOR - FEEDS') return 'DISTRIBUTOR - FEEDS';
  if (c === 'DISTRIBUTOR') return 'DISTRIBUTOR';
  if (c === 'KEY ACCOUNT') return 'KEY ACCOUNT';
  if (c === 'HUB') return 'HUB';
  if (c === 'STOCKIST') return 'STOCKIST';
  if (c === 'SUPERMARKET' || c === 'MODERN TRADE') return 'SUPERMARKET';
  return 'GENERAL TRADE';
}

type CPoint = {
  id: string; name: string; cat: string; tier: string | null;
  lat: number; lng: number; last_visit: string | null;
  region: string; territory: string | null; channel: string | null; phone: string | null;
};

interface Props {
  tierVisibility: Record<string, boolean>;
  activeTier: string | null;
}

const MAX_CACHE = 50;

export default function CustomerUniverseLayer({ tierVisibility, activeTier }: Props) {
  const map = useMap();

  // Refs hold mutable state that doesn't trigger re-renders
  const tierVisRef = useRef(tierVisibility);
  tierVisRef.current = tierVisibility;
  const activeTierRef = useRef(activeTier);
  activeTierRef.current = activeTier;

  const layerGroup = useRef<L.LayerGroup | null>(null);
  const renderer = useRef(L.canvas({ padding: 0.5 }));
  const allCustomers = useRef<Map<string, CPoint>>(new Map());
  const clusterIdx = useRef<Supercluster | null>(null);
  const vpCache = useRef<Map<string, string[]>>(new Map());
  const lruOrder = useRef<string[]>([]);
  const isFetching = useRef(false);
  const needsUpdate = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Cache key: rounded to 2dp to create tiles ──────────────────────────────
  const cacheKey = useCallback((bounds: L.LatLngBounds, zoom: number) => {
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    return `${sw.lat.toFixed(2)},${sw.lng.toFixed(2)},${ne.lat.toFixed(2)},${ne.lng.toFixed(2)},${Math.floor(zoom)}`;
  }, []);

  // ── Rebuild supercluster index from accumulated customers ───────────────────
  const rebuildIdx = useCallback(() => {
    const tv = tierVisRef.current;
    const points = Array.from(allCustomers.current.values())
      .filter(c => tv[normCat(c.cat)] ?? true)
      .map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { ...c },
      }));
    const idx = new Supercluster({ radius: 60, maxZoom: 14, minPoints: 3 });
    idx.load(points);
    clusterIdx.current = idx;
  }, []);

  // ── Render clusters for the current viewport ────────────────────────────────
  const renderLayer = useCallback(() => {
    if (!clusterIdx.current) return;
    if (!layerGroup.current) {
      layerGroup.current = L.layerGroup().addTo(map);
    } else {
      layerGroup.current.clearLayers();
    }

    const bounds = map.getBounds();
    const zoom = Math.floor(map.getZoom());
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const clusters = clusterIdx.current.getClusters([sw.lng, sw.lat, ne.lng, ne.lat], zoom);

    for (const cl of clusters) {
      const [lng, lat] = cl.geometry.coordinates;
      const pos: L.LatLngTuple = [lat, lng];

      if ((cl.properties as Supercluster.ClusterProperties).cluster) {
        const props = cl.properties as Supercluster.ClusterProperties;
        const count = props.point_count;
        const size = count > 1000 ? 52 : count > 500 ? 46 : count > 100 ? 38 : count > 10 ? 30 : 22;
        const label = count >= 10000 ? `${Math.round(count / 1000)}k`
          : count >= 1000 ? `${(count / 1000).toFixed(1)}k`
          : String(count);

        const icon = L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1E3A5F;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-size:${count > 999 ? 9 : 11}px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${label}</div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const m = L.marker(pos, { icon });
        m.on('click', () => {
          const ez = clusterIdx.current!.getClusterExpansionZoom(props.cluster_id);
          map.flyTo(pos, Math.min(ez + 1, 18), { duration: 0.5 });
        });
        m.bindTooltip(`${count.toLocaleString()} outlets`, { direction: 'top' });
        layerGroup.current!.addLayer(m);
      } else {
        const p = cl.properties as CPoint;
        const normalized = normCat(p.cat);
        const color = COLOURS[normalized] || '#9E9E9E';
        const isVisited = !!p.last_visit;
        const radius = normalized === 'DISTRIBUTOR' ? 8
          : normalized === 'KEY ACCOUNT' ? 6
          : normalized === 'HUB' ? 6
          : normalized === 'SUPERMARKET' ? 5
          : normalized === 'STOCKIST' ? 4 : 3;

        const fmt = (d: string) =>
          d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';

        const cm = L.circleMarker(pos, {
          renderer: renderer.current,
          radius,
          fillColor: isVisited ? color : '#FFFFFF',
          fillOpacity: isVisited ? 0.85 : 0.9,
          color,
          weight: isVisited ? 1 : 1.5,
          dashArray: isVisited ? undefined : '4 3',
        });

        cm.bindTooltip(
          `${p.name} · ${p.cat}${!isVisited ? ' · Never visited' : ''}`,
          { direction: 'top' }
        );
        cm.bindPopup(`
          <div style="font-family:Inter,system-ui,sans-serif;padding:2px 0">
            <div style="font-weight:700;color:#1E3A5F;font-size:13px;margin-bottom:4px">${p.name}</div>
            <span style="background:${color};color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px">${p.cat}</span>
            <span style="background:${isVisited ? '#DCFCE7' : '#FEF2F2'};color:${isVisited ? '#16A34A' : '#EF4444'};font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;margin-left:4px">${isVisited ? 'Visited' : 'Never visited'}</span>
            <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
              ${p.region ? `<tr><td style="color:#6B7280;padding-right:8px;padding-bottom:3px">Region</td><td style="color:#1E3A5F;font-weight:600">${p.region}</td></tr>` : ''}
              ${p.territory ? `<tr><td style="color:#6B7280;padding-right:8px;padding-bottom:3px">Territory</td><td style="color:#1E3A5F;font-weight:600">${p.territory}</td></tr>` : ''}
              ${p.channel ? `<tr><td style="color:#6B7280;padding-right:8px;padding-bottom:3px">Channel</td><td style="color:#1E3A5F;font-weight:600">${p.channel}</td></tr>` : ''}
              <tr><td style="color:#6B7280;padding-right:8px;padding-bottom:3px">Last visit</td><td style="color:#1E3A5F;font-weight:600">${fmt(p.last_visit ?? '')}</td></tr>
              ${p.phone ? `<tr><td style="color:#6B7280;padding-right:8px">Phone</td><td style="color:#1E3A5F;font-weight:600">${p.phone}</td></tr>` : ''}
            </table>
          </div>
        `, { minWidth: 200, maxWidth: 260 });

        layerGroup.current!.addLayer(cm);
      }
    }
  }, [map]);

  // ── Fetch viewport data, accumulate, rebuild index, re-render ───────────────
  const fetchAndRender = useCallback(async () => {
    if (isFetching.current) { needsUpdate.current = true; return; }
    isFetching.current = true;
    needsUpdate.current = false;

    try {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const key = cacheKey(bounds, zoom);

      if (!vpCache.current.has(key)) {
        const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
        const latPad = (ne.lat - sw.lat) * 0.1;
        const lngPad = (ne.lng - sw.lng) * 0.1;
        const at = activeTierRef.current;
        const dbCat = at === 'MODERN TRADE' ? 'SUPERMARKET' : at;

        let q = supabase
          .from('customers')
          .select('id,name,cat,tier,lat,lng,last_visit,region,territory,channel,phone')
          .gte('lat', sw.lat - latPad).lte('lat', ne.lat + latPad)
          .gte('lng', sw.lng - lngPad).lte('lng', ne.lng + lngPad)
          .not('lat', 'is', null).not('lng', 'is', null)
          .limit(5000);

        if (dbCat) q = (q as typeof q).eq('cat', dbCat);

        const { data, error } = await q;
        if (error || !data) return;

        const ids: string[] = [];
        for (const c of data) {
          allCustomers.current.set(String(c.id), c as unknown as CPoint);
          ids.push(String(c.id));
        }

        // LRU eviction — keep max MAX_CACHE viewport tiles
        if (lruOrder.current.length >= MAX_CACHE) {
          const evicted = lruOrder.current.shift()!;
          vpCache.current.delete(evicted);
        }
        vpCache.current.set(key, ids);
        lruOrder.current.push(key);

        rebuildIdx();
      }

      renderLayer();
    } finally {
      isFetching.current = false;
      if (needsUpdate.current) fetchAndRender();
    }
  }, [map, cacheKey, rebuildIdx, renderLayer]);

  const debouncedFetch = useCallback(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchAndRender, 400);
  }, [fetchAndRender]);

  // ── Tier visibility change: rebuild index + re-render (no new fetch) ─────────
  useEffect(() => {
    if (allCustomers.current.size === 0) return;
    rebuildIdx();
    renderLayer();
  }, [tierVisibility, rebuildIdx, renderLayer]);

  // ── activeTier change: clear cache + re-fetch ────────────────────────────────
  useEffect(() => {
    vpCache.current.clear();
    lruOrder.current = [];
    allCustomers.current.clear();
    clusterIdx.current = null;
    if (layerGroup.current) layerGroup.current.clearLayers();
    fetchAndRender();
  }, [activeTier, fetchAndRender]);

  // ── Mount: attach map event listeners; unmount: clean up ─────────────────────
  useEffect(() => {
    map.on('moveend', debouncedFetch);
    map.on('zoomend', debouncedFetch);
    return () => {
      clearTimeout(debounceTimer.current);
      map.off('moveend', debouncedFetch);
      map.off('zoomend', debouncedFetch);
      if (layerGroup.current) {
        map.removeLayer(layerGroup.current);
        layerGroup.current = null;
      }
    };
  }, [map, debouncedFetch]);

  return null;
}
