import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { FilterState, LayerState, Tier, Region } from '../types';

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
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [layers, setLayers] = useState<LayerState>(defaultLayers);
  const [selectedRep, setSelectedRepState] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);

  const setSelectedRep = useCallback((rep: string | null) => {
    setSelectedRepState(rep);
    if (!rep) {
      setFilters(prev => ({ ...prev, fieldStaff: null }));
    } else {
      setFilters(prev => ({ ...prev, fieldStaff: rep }));
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSelectedRepState(null);
    setSelectedShop(null);
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
  }), [filters, layers, selectedRep, selectedShop, setSelectedRep, clearFilters]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}

// Selector hooks to avoid unnecessary re-renders
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
