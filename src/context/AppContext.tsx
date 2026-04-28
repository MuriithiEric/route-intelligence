import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { FilterState, LayerState, Region } from '../types';
import { DEFAULT_TIER_VISIBILITY } from '../types';

export type RepStatusFilter = 'all' | 'active' | 'inactive';

export interface MapFlyTarget {
  lat: number;
  lng: number;
  zoom: number;
  label?: string;
}

interface AppContextValue {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  layers: LayerState;
  setLayers: React.Dispatch<React.SetStateAction<LayerState>>;
  selectedRep: string | null;
  setSelectedRep: (rep: string | null) => void;
  selectedShop: string | null;
  setSelectedShop: (shop: string | null) => void;
  clearFilters: () => void;
  repStatusFilter: RepStatusFilter;
  setRepStatusFilter: React.Dispatch<React.SetStateAction<RepStatusFilter>>;
  // Compare feature
  compareMode: boolean;
  setCompareMode: React.Dispatch<React.SetStateAction<boolean>>;
  compareRep1: string | null;
  setCompareRep1: React.Dispatch<React.SetStateAction<string | null>>;
  compareRep2: string | null;
  setCompareRep2: React.Dispatch<React.SetStateAction<string | null>>;
  // Universe panel
  showUniversePanel: boolean;
  setShowUniversePanel: React.Dispatch<React.SetStateAction<boolean>>;
  // Map fly-to
  mapFlyTo: MapFlyTarget | null;
  setMapFlyTo: React.Dispatch<React.SetStateAction<MapFlyTarget | null>>;
  // Rep date filter — drives both RepActivityPanel and the map day-route layer
  repDateFrom: string | null;
  repDateTo: string | null;
  setRepDateFrom: React.Dispatch<React.SetStateAction<string | null>>;
  setRepDateTo: React.Dispatch<React.SetStateAction<string | null>>;
}

const defaultFilters: FilterState = {
  userGroup: null,
  fieldStaff: null,
  route: null,
  region: null,
  dateFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  dateTo: new Date().toISOString().split('T')[0],
  activeTier: null,
};

const defaultLayers: LayerState = {
  fieldStaff: true,
  customerUniverse: false,
  customerTier: null,
  routes: true,
  tierVisibility: { ...DEFAULT_TIER_VISIBILITY },
  showUnvisited: false,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [layers, setLayers] = useState<LayerState>(defaultLayers);
  const [selectedRep, setSelectedRepState] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [repStatusFilter, setRepStatusFilter] = useState<RepStatusFilter>('all');
  const [compareMode, setCompareMode] = useState(false);
  const [compareRep1, setCompareRep1] = useState<string | null>(null);
  const [compareRep2, setCompareRep2] = useState<string | null>(null);
  const [showUniversePanel, setShowUniversePanel] = useState(false);
  const [mapFlyTo, setMapFlyTo] = useState<MapFlyTarget | null>(null);
  const [repDateFrom, setRepDateFrom] = useState<string | null>(null);
  const [repDateTo, setRepDateTo] = useState<string | null>(null);

  const setSelectedRep = useCallback((rep: string | null) => {
    setSelectedRepState(rep);
    if (!rep) {
      setFilters(prev => ({ ...prev, fieldStaff: null }));
      setRepDateFrom(null);
      setRepDateTo(null);
    } else {
      setFilters(prev => ({ ...prev, fieldStaff: rep }));
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSelectedRepState(null);
    setSelectedShop(null);
    setCompareMode(false);
    setCompareRep1(null);
    setCompareRep2(null);
    setRepDateFrom(null);
    setRepDateTo(null);
  }, []);

  const value = useMemo(() => ({
    filters,
    setFilters,
    layers,
    setLayers,
    selectedRep,
    setSelectedRep,
    selectedShop,
    setSelectedShop,
    clearFilters,
    repStatusFilter,
    setRepStatusFilter,
    compareMode,
    setCompareMode,
    compareRep1,
    setCompareRep1,
    compareRep2,
    setCompareRep2,
    showUniversePanel,
    setShowUniversePanel,
    mapFlyTo,
    setMapFlyTo,
    repDateFrom,
    repDateTo,
    setRepDateFrom,
    setRepDateTo,
  }), [filters, layers, selectedRep, selectedShop, setSelectedRep, clearFilters, repStatusFilter,
       compareMode, compareRep1, compareRep2, showUniversePanel, mapFlyTo,
       repDateFrom, repDateTo]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}

export function useFilters() {
  const { filters } = useAppContext();
  return filters;
}

export function useLayers() {
  const { layers, setLayers } = useAppContext();
  return { layers, setLayers };
}

export function useSelectedRep() {
  const { selectedRep, setSelectedRep } = useAppContext();
  return { selectedRep, setSelectedRep };
}
