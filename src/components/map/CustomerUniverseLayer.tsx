import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';

const CAT_COLOURS: Record<string, string> = {
  DISTRIBUTOR: '#C0392B',
  'KEY ACCOUNT': '#8E44AD',
  HUB: '#E67E22',
  STOCKIST: '#D35400',
  SUPERMARKET: '#0E8C7A',
  'GENERAL TRADE': '#7F8C8D',
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

function getRadius(normalized: string): number {
  if (normalized === 'DISTRIBUTOR') return 8;
  if (normalized === 'KEY ACCOUNT') return 7;
  if (normalized === 'HUB') return 7;
  if (normalized === 'STOCKIST') return 6;
  if (normalized === 'SUPERMARKET') return 6;
  if (normalized === 'DISTRIBUTOR - FEEDS') return 5;
  return 4; // GENERAL TRADE — min 4 so every dot is visible at zoom 6
}

type CPoint = {
  id: string;
  name: string;
  cat: string;
  lat: number;
  lng: number;
  visited: boolean;
};

interface Props {
  tierVisibility: Record<string, boolean>;
  activeTier: string | null;
  onCountChange?: (count: number) => void;
  onLoadProgress?: (loaded: number, total: number | null) => void;
  onTierCounts?: (counts: Record<string, number>) => void;
}

// Module-level singleton — data survives toggle off/on within the same session
const _globalCache: {
  customers: CPoint[];
  loaded: boolean;
  loading: boolean;
  pendingCallbacks: Array<() => void>;
} = {
  customers: [],
  loaded: false,
  loading: false,
  pendingCallbacks: [],
};

export default function CustomerUniverseLayer({
  tierVisibility,
  activeTier,
  onCountChange,
  onLoadProgress,
  onTierCounts,
}: Props) {
  const map = useMap();

  // Stable refs — callbacks always read the latest props without stale closures
  const tierVisRef = useRef(tierVisibility);
  tierVisRef.current = tierVisibility;
  const activeTierRef = useRef(activeTier);
  activeTierRef.current = activeTier;
  const onCountRef = useRef(onCountChange);
  onCountRef.current = onCountChange;
  const onProgressRef = useRef(onLoadProgress);
  onProgressRef.current = onLoadProgress;
  const onTierCountsRef = useRef(onTierCounts);
  onTierCountsRef.current = onTierCounts;

  const layerGroup = useRef<L.LayerGroup | null>(null);
  // Single shared canvas for all customer markers — one paint call
  const renderer = useRef(L.canvas({ padding: 0.5 }));

  const renderLayer = useCallback(() => {
    if (!layerGroup.current) {
      layerGroup.current = L.layerGroup().addTo(map);
    } else {
      layerGroup.current.clearLayers();
    }

    const tv = tierVisRef.current;
    const at = activeTierRef.current ? normCat(activeTierRef.current) : null;
    let count = 0;

    for (const c of _globalCache.customers) {
      const normalized = normCat(c.cat);
      if (at && normalized !== at) continue;
      if (!(tv[normalized] ?? true)) continue;

      const color = CAT_COLOURS[normalized] || '#7F8C8D';
      const radius = getRadius(normalized);

      const cm = L.circleMarker([c.lat, c.lng], {
        renderer: renderer.current,
        radius,
        fillColor: c.visited ? color : '#FFFFFF',
        fillOpacity: c.visited ? 0.85 : 0.25,
        color,
        weight: c.visited ? 1 : 1.5,
        dashArray: c.visited ? undefined : '4,3',
      });

      const { name, cat, visited } = c;
      cm.bindPopup(
        () => `
          <div style="font-family:Inter,system-ui,sans-serif;padding:2px 0;min-width:160px">
            <div style="font-weight:700;color:#1E3A5F;font-size:13px;margin-bottom:4px">${name}</div>
            <span style="background:${color};color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px">${cat}</span>
            <div style="font-size:11px;color:#6B7280;margin-top:6px">
              ${visited
                ? '<span style="color:#16A34A">&#10003; Visited</span>'
                : '<span style="color:#EF4444">&#9711; Never visited</span>'}
            </div>
          </div>
        `,
        { maxWidth: 220 },
      );

      layerGroup.current.addLayer(cm);
      count++;
    }

    onCountRef.current?.(count);
  }, [map]);

  const loadAll = useCallback(async () => {
    // Data already in cache — render immediately, no network
    if (_globalCache.loaded) {
      onProgressRef.current?.(_globalCache.customers.length, _globalCache.customers.length);
      renderLayer();
      // Report per-tier counts
      const counts: Record<string, number> = {};
      for (const c of _globalCache.customers) {
        const n = normCat(c.cat);
        counts[n] = (counts[n] || 0) + 1;
      }
      onTierCountsRef.current?.(counts);
      return;
    }

    // Another mount is already loading — queue render for when it finishes
    if (_globalCache.loading) {
      _globalCache.pendingCallbacks.push(() => {
        onProgressRef.current?.(_globalCache.customers.length, _globalCache.customers.length);
        renderLayer();
        const counts: Record<string, number> = {};
        for (const c of _globalCache.customers) {
          const n = normCat(c.cat);
          counts[n] = (counts[n] || 0) + 1;
        }
        onTierCountsRef.current?.(counts);
      });
      return;
    }

    _globalCache.loading = true;
    onProgressRef.current?.(0, null);

    try {
      const PAGE = 1000;
      let from = 0;
      const raw: Array<{ id: string; name: string; cat: string; lat: number; lng: number; last_visit: string | null }> = [];

      while (true) {
        const { data, error } = await supabase
          .from('customers')
          .select('id,name,cat,lat,lng,last_visit')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .range(from, from + PAGE - 1);

        if (error || !data || data.length === 0) break;
        raw.push(...(data as typeof raw));
        from += PAGE;
        onProgressRef.current?.(raw.length, null);
        if (data.length < PAGE) break;
      }

      _globalCache.customers = raw.map(c => ({
        id: c.id,
        name: c.name,
        cat: c.cat,
        lat: c.lat,
        lng: c.lng,
        visited: !!c.last_visit,
      }));
      _globalCache.loaded = true;
    } finally {
      _globalCache.loading = false;
    }

    // Report final count + tier breakdown
    const total = _globalCache.customers.length;
    onProgressRef.current?.(total, total);
    const counts: Record<string, number> = {};
    for (const c of _globalCache.customers) {
      const n = normCat(c.cat);
      counts[n] = (counts[n] || 0) + 1;
    }
    onTierCountsRef.current?.(counts);

    renderLayer();

    // Wake up any queued instances
    for (const cb of _globalCache.pendingCallbacks) cb();
    _globalCache.pendingCallbacks = [];
  }, [renderLayer]);

  // Tier visibility toggle — instant re-render from cache, zero network
  useEffect(() => {
    if (!_globalCache.loaded) return;
    renderLayer();
  }, [tierVisibility, renderLayer]);

  // activeTier change — re-render from cache
  useEffect(() => {
    if (!_globalCache.loaded) return;
    renderLayer();
  }, [activeTier, renderLayer]);

  // Mount: load (or restore from cache) and attach to map
  useEffect(() => {
    loadAll();
    return () => {
      if (layerGroup.current) {
        map.removeLayer(layerGroup.current);
        layerGroup.current = null;
      }
    };
  }, [map, loadAll]);

  return null;
}
