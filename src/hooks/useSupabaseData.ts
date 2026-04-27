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
    routeCount: null,
    shopsVisited: null,
    loading: true,
  });

  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    async function loadMountData() {
      try {
        const [ttmResult, ugResult, rsResult, ugrResult, countsResult, routeCountResult] = await Promise.all([
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
              supabase.from('customers').select('*', { count: 'exact', head: true }),
            ]);
            // GENERAL TRADE customers have cat = null in the DB, so .eq('cat','GENERAL TRADE')
            // returns 0. Derive GT count as total − all explicitly-categorised customers.
            const distN = dist.count ?? 0;
            const kaN   = ka.count   ?? 0;
            const hubN  = hub.count  ?? 0;
            const stN   = st.count   ?? 0;
            const mtN   = mt.count   ?? 0;
            const totalN = all.count ?? 0;
            return {
              DISTRIBUTOR:      distN,
              'KEY ACCOUNT':    kaN,
              HUB:              hubN,
              STOCKIST:         stN,
              'MODERN TRADE':   mtN,
              'GENERAL TRADE':  totalN - distN - kaN - hubN - stN - mtN,
              total:            totalN,
            };
          }),
          cachedQuery<number | null>('route_summary:count', async () => {
            const { count, error } = await supabase
              .from('route_summary')
              .select('*', { count: 'exact', head: true });
            if (error) return null;
            return count;
          }),
        ]);

        setData({
          ttmSummary: ttmResult,
          userGroups: ugResult,
          routeSummary: rsResult,
          userGroupRegions: ugrResult,
          customerCounts: countsResult,
          routeCount: routeCountResult,
          shopsVisited: null,
          loading: false,
        });

        // Background: COUNT(DISTINCT shop_id) from visit_frequency via parallel pagination
        const distinctShops = await cachedQuery<number>('visit_frequency:distinct_shops', async () => {
          const PAGE = 1000;
          const { count } = await supabase.from('visit_frequency').select('shop_id', { count: 'exact', head: true });
          if (!count) return 0;
          const pages = Math.ceil(count / PAGE);
          const allIds: string[] = [];
          const BATCH = 20;
          for (let i = 0; i < pages; i += BATCH) {
            const batch = Array.from({ length: Math.min(BATCH, pages - i) }, (_, j) => {
              const from = (i + j) * PAGE;
              return supabase.from('visit_frequency').select('shop_id').range(from, from + PAGE - 1);
            });
            const results = await Promise.all(batch);
            for (const r of results) {
              if (r.data) allIds.push(...(r.data as { shop_id: string }[]).map(row => row.shop_id));
            }
          }
          return new Set(allIds).size;
        });
        setData(prev => ({ ...prev, shopsVisited: distinctShops }));
      } catch (err) {
        console.error('Failed to load mount data:', err);
        setData(prev => ({ ...prev, loading: false }));
      }
    }

    loadMountData();
  }, []);

  return data;
}
