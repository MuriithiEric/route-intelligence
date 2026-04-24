import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  MapContainer as LeafletMap,
  TileLayer,
  CircleMarker,
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
import { GROUP_COLOURS, TIER_COLOURS } from '../types';

// Fix Leaflet default icon URLs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Debounce utility
function useDebounce(fn: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(), delay);
  }, [delay]);
}

// County boundaries layer

// Customer universe layer — loads on demand with bounding box
function CustomerUniverseLayer({ activeTier }: { activeTier: string | null }) {
  const { fetchCustomersInBounds } = useMapData();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const map = useMap();

  const loadCustomers = useCallback(async () => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    // Require zoom 7+ when a specific tier is selected; zoom 9+ for the full universe
    const minZoom = activeTier ? 7 : 9;
    if (zoom < minZoom) { setCustomers([]); return; }

    try {
      const data = await fetchCustomersInBounds({
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      }, activeTier);
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  }, [map, fetchCustomersInBounds, activeTier]);

  const debouncedLoad = useDebounce(loadCustomers, 500);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useMapEvents({
    moveend: debouncedLoad,
    zoomend: debouncedLoad,
  });

  const zoom = map.getZoom();

  return (
    <MarkerClusterGroup chunkedLoading>
      {customers.map(c => {
        if (!c.lat || !c.lng) return null;

        // Use `cat` — the canonical classification field (consistent with counts + DB queries)
        const color = TIER_COLOURS[c.cat] || '#9E9E9E';
        const radius = c.cat === 'DISTRIBUTOR' ? 8
          : c.cat === 'KEY ACCOUNT' ? 7
          : c.cat === 'HUB' ? 6
          : c.cat === 'MODERN TRADE' ? 5
          : c.cat === 'STOCKIST' ? 4
          : 3;

        const pos: LatLngTuple = [c.lat, c.lng];

        const formatDate = (d: string) =>
          d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

        return (
          <CircleMarker
            key={c.id}
            center={pos}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -radius]}>
              <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 }}>
                {c.name} · {c.region}
              </span>
            </Tooltip>
            <Popup minWidth={200} maxWidth={260}>
              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 0' }}>
                <div style={{ fontWeight: 700, color: '#1E3A5F', fontSize: 13, marginBottom: 4 }}>
                  {c.name}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-block',
                    background: color,
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 10,
                  }}>
                    {c.cat}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    {c.region && (
                      <tr>
                        <td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Region</td>
                        <td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.region}</td>
                      </tr>
                    )}
                    {c.territory && (
                      <tr>
                        <td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Territory</td>
                        <td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.territory}</td>
                      </tr>
                    )}
                    {c.channel && (
                      <tr>
                        <td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Channel</td>
                        <td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.channel}</td>
                      </tr>
                    )}
                    {c.loc && (
                      <tr>
                        <td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Location</td>
                        <td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.loc}</td>
                      </tr>
                    )}
                    {c.last_visit && (
                      <tr>
                        <td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Last visit</td>
                        <td style={{ color: '#1E3A5F', fontWeight: 600 }}>{formatDate(c.last_visit)}</td>
                      </tr>
                    )}
                    {c.last_sale && (
                      <tr>
                        <td style={{ color: '#6B7280', paddingRight: 8, paddingBottom: 3 }}>Last sale</td>
                        <td style={{ color: '#1E3A5F', fontWeight: 600 }}>{formatDate(c.last_sale)}</td>
                      </tr>
                    )}
                    {c.phone && (
                      <tr>
                        <td style={{ color: '#6B7280', paddingRight: 8 }}>Phone</td>
                        <td style={{ color: '#1E3A5F', fontWeight: 600 }}>{c.phone}</td>
                      </tr>
                    )}
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

// Rep visited shops layer — shows all shops a selected rep has visited
function RepVisitedShopsLayer({
  visits,
  repColor,
}: {
  visits: Visit[];
  repColor: string;
}) {
  if (visits.length === 0) return null;

  // Deduplicate by shop_id, count visits per shop
  const shopMap = visits.reduce<Record<string, {
    shop_id: string;
    shop_name: string;
    lat: number;
    lng: number;
    region: string;
    visit_count: number;
    last_visit: string;
    route_name: string;
  }>>((acc, v) => {
    if (!v.lat || !v.lng) return acc;
    if (!acc[v.shop_id]) {
      acc[v.shop_id] = {
        shop_id: v.shop_id,
        shop_name: v.shop_name,
        lat: v.lat,
        lng: v.lng,
        region: v.region,
        visit_count: 0,
        last_visit: v.check_in,
        route_name: v.route_name,
      };
    }
    acc[v.shop_id].visit_count += 1;
    // Track most recent visit
    if (v.check_in > acc[v.shop_id].last_visit) {
      acc[v.shop_id].last_visit = v.check_in;
    }
    return acc;
  }, {});

  const shops = Object.values(shopMap);
  const maxVisits = Math.max(...shops.map(s => s.visit_count), 1);

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // No clustering — every shop shown individually when a rep is selected
  return (
    <>
      {shops.map(shop => {
        // Scale radius: 1 visit = 6px, max visits = 14px
        const radius = 6 + Math.round((shop.visit_count / maxVisits) * 8);
        // Opacity scales with visit count too
        const fillOpacity = 0.5 + (shop.visit_count / maxVisits) * 0.45;

        return (
          <CircleMarker
            key={shop.shop_id}
            center={[shop.lat, shop.lng] as LatLngTuple}
            radius={radius}
            pathOptions={{
              color: '#FFFFFF',
              weight: 1.5,
              fillColor: repColor,
              fillOpacity,
            }}
          >
            <Tooltip direction="top" offset={[0, -radius]}>
              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', minWidth: 160 }}>
                <div style={{ fontWeight: 700, color: '#1E3A5F', fontSize: 12 }}>{shop.shop_name}</div>
                <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{shop.region}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, gap: 12 }}>
                  <span style={{ color: repColor, fontWeight: 700, fontSize: 11 }}>
                    {shop.visit_count}× visited
                  </span>
                  <span style={{ color: '#9CA3AF', fontSize: 10 }}>
                    Last: {formatDate(shop.last_visit)}
                  </span>
                </div>
                {shop.route_name && (
                  <div style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2 }}>
                    Route: {shop.route_name}
                  </div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

// Route layer
function RoutesLayer({
  repName,
  visits,
  repColor,
}: {
  repName: string | null;
  visits: Visit[];
  repColor: string;
}) {
  if (!repName || visits.length === 0) return null;

  // Group visits by route_id, sort each group chronologically
  const routeGroups = visits.reduce<Record<string, Visit[]>>((acc, v) => {
    if (!acc[v.route_id]) acc[v.route_id] = [];
    acc[v.route_id].push(v);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(routeGroups).map(([routeId, routeVisits]) => {
        const sorted = [...routeVisits].sort((a, b) =>
          (a.check_in || '').localeCompare(b.check_in || '')
        );
        const points = sorted
          .filter(v => v.lat && v.lng)
          .map(v => [v.lat, v.lng] as LatLngTuple);

        if (points.length < 2) return null;

        return (
          <Polyline
            key={routeId}
            positions={points}
            pathOptions={{
              color: repColor,
              weight: 2.5,
              opacity: 0.55,
            }}
          >
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

// Field staff markers layer
function FieldStaffLayer({
  ttmSummary,
  onRepClick,
  zoom,
}: {
  ttmSummary: TTMSummary[];
  onRepClick: (rep: TTMSummary) => void;
  zoom: number;
}) {
  const { selectedRep } = useAppContext();

  // Render inactive first so active markers appear on top (SVG paint order)
  const sorted = [...ttmSummary].sort((a, b) => {
    const aInactive = a.rep_status === 'Inactive' ? 0 : 1;
    const bInactive = b.rep_status === 'Inactive' ? 0 : 1;
    return aInactive - bInactive;
  });

  return (
    <MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
      {sorted.map(rep => {
        const centroid = resolveRegionCentroid(rep.primary_region);

        // Jitter based on id to spread overlapping markers
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
                <strong style={{ color: '#1E3A5F' }}>{rep.name}</strong>
                <br />
                <span style={{ color: '#6B7280', fontSize: 11 }}>{rep.role} · {rep.primary_region}</span>
                <br />
                <span style={{ color: '#9CA3AF', fontSize: 10 }}>{rep.total_visits?.toLocaleString()} visits</span>
                {isInactive && (
                  <>
                    <br />
                    <span style={{ color: '#9E9E9E', fontSize: 10 }}>● Inactive</span>
                  </>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MarkerClusterGroup>
  );
}

// Map event listener wrapper
function MapEventListener({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend: (e) => onZoomChange(e.target.getZoom()),
  });
  return null;
}

// Region centroids shared across layers
const REGION_CENTROIDS: Record<string, LatLngTuple> = {
  'NAIROBI': [-1.286, 36.818],
  'NORTH RIFT': [0.519, 35.271],
  'SOUTH RIFT': [-0.905, 36.065],
  'CENTRAL': [-0.304, 36.886],
  'LAKE': [-0.102, 34.754],
  'COAST': [-3.217, 40.117],
};

function resolveRegionCentroid(primaryRegion: string): LatLngTuple {
  const region = (primaryRegion || 'NAIROBI').toUpperCase().trim();
  if (REGION_CENTROIDS[region]) return REGION_CENTROIDS[region];
  const matchKey = Object.keys(REGION_CENTROIDS).find(k => region.includes(k) || k.includes(region));
  return matchKey ? REGION_CENTROIDS[matchKey] : REGION_CENTROIDS['NAIROBI'];
}

// Flies map to rep's region on rep select, and zooms in when a tier is activated
function MapFlyController({ ttmSummary }: { ttmSummary: TTMSummary[] }) {
  const { selectedRep, filters } = useAppContext();
  const map = useMap();
  const prevRep = useRef<string | null>(null);
  const prevTier = useRef<string | null>(null);

  // Fly to rep region when a rep is selected
  useEffect(() => {
    if (!selectedRep || selectedRep === prevRep.current) return;
    prevRep.current = selectedRep;
    const rep = ttmSummary.find(r => r.raw_name === selectedRep);
    if (!rep) return;
    const center = resolveRegionCentroid(rep.primary_region);
    map.flyTo(center, 10, { duration: 1.2, easeLinearity: 0.4 });
  }, [selectedRep, ttmSummary, map]);

  useEffect(() => {
    if (!selectedRep) prevRep.current = null;
  }, [selectedRep]);

  // Zoom to level 9 when a tier chip is activated and map is below that
  useEffect(() => {
    if (!filters.activeTier || filters.activeTier === prevTier.current) return;
    prevTier.current = filters.activeTier;
    if (map.getZoom() < 9) {
      map.flyTo(map.getCenter(), 9, { duration: 0.9, easeLinearity: 0.4 });
    }
  }, [filters.activeTier, map]);

  useEffect(() => {
    if (!filters.activeTier) prevTier.current = null;
  }, [filters.activeTier]);

  return null;
}

export default function MapContainer({ ttmSummary }: MapContainerProps) {
  const { selectedRep, setSelectedRep } = useAppContext();
  const { layers } = useLayers();
  const { fetchRepVisits } = useMapData();
  const [repVisits, setRepVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [zoom, setZoom] = useState(7);

  // Derive rep's group colour for visited-shops + route layers
  const repColor = useMemo(() => {
    if (!selectedRep) return '#C9963E';
    const rep = ttmSummary.find(r => r.raw_name === selectedRep);
    return GROUP_COLOURS[rep?.role || ''] || '#C9963E';
  }, [selectedRep, ttmSummary]);

  // Badge stats: use pre-aggregated ttm_summary totals (same source as leaderboard + rep panel)
  const repStats = useMemo(
    () => ttmSummary.find(r => r.raw_name === selectedRep) ?? null,
    [ttmSummary, selectedRep]
  );

  useEffect(() => {
    if (selectedRep) {
      setVisitsLoading(true);
      fetchRepVisits(selectedRep)
        .then(setRepVisits)
        .catch(console.error)
        .finally(() => setVisitsLoading(false));
    } else {
      setRepVisits([]);
    }
  }, [selectedRep, fetchRepVisits]);

  const handleRepClick = useCallback((rep: TTMSummary) => {
    setSelectedRep(selectedRep === rep.raw_name ? null : rep.raw_name);
  }, [selectedRep, setSelectedRep]);

  const CENTER: LatLngExpression = [0.0236, 37.9062];

  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
      {/* Selected rep info badge — floats over the map */}
      {selectedRep && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: repColor,
          color: '#FFFFFF',
          padding: '6px 10px 6px 14px',
          borderRadius: 24,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 2px 12px rgba(0,0,0,0.28)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          pointerEvents: 'all',
        }}>
          {visitsLoading ? (
            <span style={{ opacity: 0.85 }}>Loading {repStats?.name ?? selectedRep}…</span>
          ) : (
            <>
              <span>{repStats?.name ?? selectedRep}</span>
              {repStats?.role && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ fontWeight: 500, opacity: 0.85, fontSize: 11 }}>{repStats.role}</span>
                </>
              )}
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ fontWeight: 400, opacity: 0.9 }}>{repStats?.unique_shops?.toLocaleString() ?? '—'} shops</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ fontWeight: 400, opacity: 0.9 }}>{repStats?.unique_routes ?? '—'} routes</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ fontWeight: 400, opacity: 0.9 }}>{repStats?.total_visits?.toLocaleString() ?? '—'} visits</span>
            </>
          )}
          <button
            onClick={() => setSelectedRep(null)}
            title="Deselect rep"
            style={{
              marginLeft: 4,
              background: 'rgba(255,255,255,0.22)',
              border: 'none',
              borderRadius: '50%',
              width: 20,
              height: 20,
              cursor: 'pointer',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      <LeafletMap
        center={CENTER}
        zoom={7}
        style={{ width: '100%', height: '100%' }}
        zoomControl
        preferCanvas
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapEventListener onZoomChange={setZoom} />
        <MapFlyController ttmSummary={ttmSummary} />


        {layers.fieldStaff && (
          <FieldStaffLayer
            ttmSummary={ttmSummary}
            onRepClick={handleRepClick}
            zoom={zoom}
          />
        )}

        {layers.customerUniverse && (
          <CustomerUniverseLayer activeTier={layers.customerTier} />
        )}

        {/* Routes always show when a rep is selected — no layer toggle needed */}
        {selectedRep && (
          <RoutesLayer
            repName={selectedRep}
            visits={repVisits}
            repColor={repColor}
          />
        )}

        {selectedRep && repVisits.length > 0 && (
          <RepVisitedShopsLayer
            visits={repVisits}
            repColor={repColor}
          />
        )}
      </LeafletMap>
    </div>
  );
}
