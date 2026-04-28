import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';

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

function getRadius(normalized: string): number {
  if (normalized === 'DISTRIBUTOR') return 7;
  if (normalized === 'KEY ACCOUNT') return 6;
  if (normalized === 'HUB') return 6;
  if (normalized === 'STOCKIST') return 5;
  if (normalized === 'SUPERMARKET') return 5;
  if (normalized === 'DISTRIBUTOR - FEEDS') return 3;
  return 2; // GENERAL TRADE — small so it fills without overpowering
}

type CPoint = {
  id: string; name: string; cat: string;
  lat: number; lng: number; last_visit: string | null;
  region: string; territory: string | null; channel: string | null;
};

interface Props {
  tierVisibility: Record<string, boolean>;
  activeTier: string | null;
  onCountChange?: (count: number) => void;
}

const MAX_CACHE = 30;

export default function CustomerUniverseLayer({ tierVisibility, activeTier, onCountChange }: Props) {
  const map = useMap();

  // Stable refs — updated every render so callbacks never go stale
  const tierVisRef = useRef(tierVisibility);
  tierVisRef.current = tierVisibility;
  const activeTierRef = useRef(activeTier);
  activeTierRef.current = activeTier;
  const onCountRef = useRef(onCountChange);
  onCountRef.current = onCountChange;

  const layerGroup = useRef<L.LayerGroup | null>(null);
  const renderer = useRef(L.canvas({ padding: 0.5 }));

  // Current viewport batch — replaced on each fetch (no accumulation)
  const currentBatch = useRef<CPoint[]>([]);

  // LRU viewport cache: cacheKey → CPoint[]
  const vpCache = useRef<Map<string, CPoint[]>>(new Map());
  const lruOrder = useRef<string[]>([]);
  const isFetching = useRef(false);
  const needsUpdate = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 0.5-degree tile resolution to maximise cache hits across similar viewports
  const cacheKey = useCallback((bounds: L.LatLngBounds) => {
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    return [
      Math.floor(sw.lat * 2) / 2,
      Math.floor(sw.lng * 2) / 2,
      Math.ceil(ne.lat * 2) / 2,
      Math.ceil(ne.lng * 2) / 2,
    ].join(',');
  }, []);

  // ── Pure canvas render — no React, no SVG, no DOM per-marker ────────────────
  const renderLayer = useCallback(() => {
    if (!layerGroup.current) {
      layerGroup.current = L.layerGroup().addTo(map);
    } else {
      layerGroup.current.clearLayers();
    }

    const tv = tierVisRef.current;
    let count = 0;

    for (const c of currentBatch.current) {
      if (!c.lat || !c.lng) continue;
      const normalized = normCat(c.cat);
      if (!(tv[normalized] ?? true)) continue;

      const color = COLOURS[normalized] || '#9E9E9E';
      const isVisited = !!c.last_visit;
      const radius = getRadius(normalized);

      const cm = L.circleMarker([c.lat, c.lng], {
        renderer: renderer.current,
        radius,
        fillColor: isVisited ? color : '#FFFFFF',
        fillOpacity: isVisited ? 0.85 : 0.6,
        color,
        weight: isVisited ? 1 : 1.5,
        dashArray: isVisited ? undefined : '3 3',
      });

      // Lazy popup — only created on click, not on render
      const name = c.name, cat = c.cat, region = c.region, territory = c.territory, channel = c.channel;
      cm.bindPopup(() => `
        <div style="font-family:Inter,system-ui,sans-serif;padding:2px 0;min-width:180px">
          <div style="font-weight:700;color:#1E3A5F;font-size:13px;margin-bottom:4px">${name}</div>
          <span style="background:${color};color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px">${cat}</span>
          <span style="background:${isVisited ? '#DCFCE7' : '#FEF2F2'};color:${isVisited ? '#16A34A' : '#EF4444'};font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;margin-left:4px">${isVisited ? 'Visited' : 'Never visited'}</span>
          <div style="font-size:11px;margin-top:6px">
            ${region ? `<div style="color:#6B7280">Region: <strong style="color:#1E3A5F">${region}</strong></div>` : ''}
            ${territory ? `<div style="color:#6B7280">Territory: <strong style="color:#1E3A5F">${territory}</strong></div>` : ''}
            ${channel ? `<div style="color:#6B7280">Channel: <strong style="color:#1E3A5F">${channel}</strong></div>` : ''}
          </div>
        </div>
      `, { maxWidth: 220 });

      layerGroup.current.addLayer(cm);
      count++;
    }

    onCountRef.current?.(count);
  }, [map]);

  // ── Fetch viewport data → cache → render ────────────────────────────────────
  const fetchAndRender = useCallback(async () => {
    if (isFetching.current) { needsUpdate.current = true; return; }
    isFetching.current = true;
    needsUpdate.current = false;

    try {
      const bounds = map.getBounds();
      const key = cacheKey(bounds);

      if (vpCache.current.has(key)) {
        currentBatch.current = vpCache.current.get(key)!;
      } else {
        const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
        const latPad = (ne.lat - sw.lat) * 0.15;
        const lngPad = (ne.lng - sw.lng) * 0.15;
        const at = activeTierRef.current;
        const dbCat = at === 'MODERN TRADE' ? 'SUPERMARKET' : at;

        let q = supabase
          .from('customers')
          .select('id,name,cat,lat,lng,last_visit,region,territory,channel')
          .gte('lat', sw.lat - latPad).lte('lat', ne.lat + latPad)
          .gte('lng', sw.lng - lngPad).lte('lng', ne.lng + lngPad)
          .not('lat', 'is', null).not('lng', 'is', null)
          .limit(15000);

        if (dbCat) q = (q as typeof q).eq('cat', dbCat);

        const { data, error } = await q;
        if (error || !data) return;

        const batch = data as unknown as CPoint[];
        currentBatch.current = batch;

        // LRU eviction at 30 tiles
        if (lruOrder.current.length >= MAX_CACHE) {
          const evicted = lruOrder.current.shift()!;
          vpCache.current.delete(evicted);
        }
        vpCache.current.set(key, batch);
        lruOrder.current.push(key);
      }

      renderLayer();
    } finally {
      isFetching.current = false;
      if (needsUpdate.current) fetchAndRender();
    }
  }, [map, cacheKey, renderLayer]);

  const debouncedFetch = useCallback(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchAndRender, 350);
  }, [fetchAndRender]);

  // Tier toggle: instant re-render from existing batch — no network
  useEffect(() => {
    if (currentBatch.current.length === 0) return;
    renderLayer();
  }, [tierVisibility, renderLayer]);

  // activeTier change: flush cache + re-fetch with new server filter
  useEffect(() => {
    vpCache.current.clear();
    lruOrder.current = [];
    currentBatch.current = [];
    if (layerGroup.current) layerGroup.current.clearLayers();
    onCountRef.current?.(0);
    fetchAndRender();
  }, [activeTier, fetchAndRender]);

  // Mount: initial fetch + event listeners; unmount: clean up layer + listeners
  useEffect(() => {
    fetchAndRender();
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
  }, [map, fetchAndRender, debouncedFetch]);

  return null;
}
