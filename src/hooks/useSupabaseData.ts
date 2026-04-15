import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { TTMSummary, UserGroup, RouteSummary, UserGroupRegion, CustomerCategoryCounts, AppData } from '../types';

// Global query cache — survives across hook re-mounts
const queryCache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return queryCache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  queryCache.set(key, value);
}

export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;
  const result = await fetcher();
  setCached(key, result);
  return result;
}

export function useSupabaseData(): AppData {
  const [data, setData] = useState<AppData>({
    ttmSummary: [],
    userGroups: [],
    routeSummary: [],
    userGroupRegions: [],
    customerCounts: null,
    loading: true,
  });

  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    async function loadMountData() {
      try {
        const [ttmResult, ugResult, rsResult, ugrResult, countsResult] = await Promise.all([
          cachedQuery<TTMSummary[]>('ttm_summary:all', async () => {
            const { data, error } = await supabase.from('ttm_summary').select('*');
            if (error) throw error;
            return data || [];
          }),
          cachedQuery<UserGroup[]>('user_groups:all', async () => {
            const { data, error } = await supabase.from('user_groups').select('*');
            if (error) throw error;
            return data || [];
          }),
          cachedQuery<RouteSummary[]>('route_summary:all', async () => {
            const { data, error } = await supabase.from('route_summary').select('*');
            if (error) throw error;
            return data || [];
          }),
          cachedQuery<UserGroupRegion[]>('user_group_regions:all', async () => {
            const { data, error } = await supabase.from('user_group_regions').select('*');
            if (error) throw error;
            return data || [];
          }),
          // COUNT(*) per category via the `cat` column — same field used by map filtering
          cachedQuery<CustomerCategoryCounts>('customers:cat_counts', async () => {
            const [dist, ka, hub, st, mt, gt, all] = await Promise.all([
              supabase.from('customers').select('*', { count: 'exact', head: true }).eq('cat', 'DISTRIBUTOR'),
              supabase.from('customers').select('*', { count: 'exact', head: true }).eq('cat', 'KEY ACCOUNT'),
              supabase.from('customers').select('*', { count: 'exact', head: true }).eq('cat', 'HUB'),
              supabase.from('customers').select('*', { count: 'exact', head: true }).eq('cat', 'STOCKIST'),
              supabase.from('customers').select('*', { count: 'exact', head: true }).eq('cat', 'MODERN TRADE'),
              supabase.from('customers').select('*', { count: 'exact', head: true }).eq('cat', 'GENERAL TRADE'),
              // True total: SELECT COUNT(*) FROM customers
              supabase.from('customers').select('*', { count: 'exact', head: true }),
            ]);
            return {
              DISTRIBUTOR:      dist.count ?? 0,
              'KEY ACCOUNT':    ka.count   ?? 0,
              HUB:              hub.count  ?? 0,
              STOCKIST:         st.count   ?? 0,
              'MODERN TRADE':   mt.count   ?? 0,
              'GENERAL TRADE':  gt.count   ?? 0,
              total:            all.count  ?? 0,
            };
          }),
        ]);

        setData({
          ttmSummary: ttmResult,
          userGroups: ugResult,
          routeSummary: rsResult,
          userGroupRegions: ugrResult,
          customerCounts: countsResult,
          loading: false,
        });
      } catch (err) {
        console.error('Failed to load mount data:', err);
        setData(prev => ({ ...prev, loading: false }));
      }
    }

    loadMountData();
  }, []);

  return data;
}
