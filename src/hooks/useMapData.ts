import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { cachedQuery } from './useSupabaseData';
import type { Visit, Customer, RepProfile, DailyActivity, VisitFrequency, ShopVisitRow, RouteSummary } from '../types';

interface BoundingBox {
  minLat: number; maxLat: number;
  minLng: number; maxLng: number;
}

export function useMapData() {
  const fetchCustomersInBounds = useCallback(async (
    bounds: BoundingBox,
    tier?: string | null
  ): Promise<Customer[]> => {
    const tierKey = tier || 'all';
    const key = `customers:${bounds.minLat.toFixed(3)},${bounds.maxLat.toFixed(3)},${bounds.minLng.toFixed(3)},${bounds.maxLng.toFixed(3)}:${tierKey}`;

    return cachedQuery<Customer[]>(key, async () => {
      let query = supabase
        .from('customers')
        .select('id,name,cat,tier,region,loc,channel,territory,lat,lng,last_visit,last_sale,phone')
        .gte('lat', bounds.minLat)
        .lte('lat', bounds.maxLat)
        .gte('lng', bounds.minLng)
        .lte('lng', bounds.maxLng);

      if (tier) {
        query = query.eq('cat', tier);
      }

      // Tier-filtered queries are scoped to viewport + one category, so the result set is small enough to fetch fully.
      // The all-tiers path keeps a 5000 cap to avoid DOM overload when no filter is active.
      const { data, error } = await (tier ? query : query.limit(5000));
      if (error) throw error;
      return data || [];
    });
  }, []);

  const fetchRepVisits = useCallback(async (repName: string): Promise<Visit[]> => {
    const key = `visits:rep:${repName}`;
    return cachedQuery<Visit[]>(key, async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('rep_name', repName)
        .order('check_in', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    });
  }, []);

  const fetchCategoryVisits = useCallback(async (category: string): Promise<Visit[]> => {
    const key = `visits:category:${category}`;
    return cachedQuery<Visit[]>(key, async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('category', category)
        .limit(500);
      if (error) throw error;
      return (data || []) as Visit[];
    });
  }, []);

  const fetchRepProfile = useCallback(async (repName: string): Promise<RepProfile | null> => {
    const key = `rep_profiles:${repName}`;
    return cachedQuery<RepProfile | null>(key, async () => {
      const { data, error } = await supabase
        .from('rep_profiles')
        .select('*')
        .eq('name', repName)
        .single();
      if (error) return null;
      return data;
    });
  }, []);

  const fetchRepDailyActivity = useCallback(async (repName: string): Promise<DailyActivity[]> => {
    const key = `daily_activity:${repName}`;
    return cachedQuery<DailyActivity[]>(key, async () => {
      const { data, error } = await supabase
        .from('daily_activity')
        .select('*')
        .eq('rep_name', repName)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    });
  }, []);

  const fetchRepShopVisits = useCallback(async (repName: string): Promise<ShopVisitRow[]> => {
    const key = `shop_visits:${repName}`;
    return cachedQuery<ShopVisitRow[]>(key, async () => {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          shop_id,
          shop_name,
          region,
          check_in,
          duration,
          customers!left(cat, tier),
          visit_frequency!left(visit_count, first_visit, last_visit)
        `)
        .eq('rep_name', repName)
        .order('check_in', { ascending: false });

      if (error) {
        // Fallback: fetch visits without join
        const { data: visitsData, error: vErr } = await supabase
          .from('visits')
          .select('shop_id,shop_name,region,check_in,duration')
          .eq('rep_name', repName)
          .order('check_in', { ascending: false });
        if (vErr) throw vErr;
        return (visitsData || []).map((v: Record<string, unknown>) => ({
          shop_id: v.shop_id as string,
          shop_name: v.shop_name as string,
          cat: null,
          tier: null,
          region: v.region as string,
          check_in: v.check_in as string,
          duration: v.duration as number,
          visit_count: 1,
          first_visit: v.check_in as string,
          last_visit: v.check_in as string,
        }));
      }

      return (data || []).map((row: Record<string, unknown>) => {
        const cust = row.customers as Record<string, string> | null;
        const vf = row.visit_frequency as Record<string, unknown> | null;
        return {
          shop_id: row.shop_id as string,
          shop_name: row.shop_name as string,
          cat: cust?.cat || null,
          tier: cust?.tier || null,
          region: row.region as string,
          check_in: row.check_in as string,
          duration: row.duration as number,
          visit_count: (vf?.visit_count as number) || 1,
          first_visit: (vf?.first_visit as string) || row.check_in as string,
          last_visit: (vf?.last_visit as string) || row.check_in as string,
        };
      });
    });
  }, []);


  const fetchVisitFrequency = useCallback(async (repName: string): Promise<VisitFrequency[]> => {
    const key = `visit_frequency:${repName}`;
    return cachedQuery<VisitFrequency[]>(key, async () => {
      const { data, error } = await supabase
        .from('visit_frequency')
        .select('*')
        .eq('rep_name', repName);
      if (error) throw error;
      return data || [];
    });
  }, []);

  const fetchRepRoutes = useCallback(async (repName: string): Promise<RouteSummary[]> => {
    const key = `route_summary:rep:${repName}`;
    return cachedQuery<RouteSummary[]>(key, async () => {
      const { data, error } = await supabase
        .from('route_summary')
        .select('*')
        .eq('rep_name', repName);
      if (error) throw error;
      return data || [];
    });
  }, []);

  return {
    fetchCustomersInBounds,
    fetchRepVisits,
    fetchCategoryVisits,
    fetchRepProfile,
    fetchRepDailyActivity,
    fetchRepShopVisits,
    fetchVisitFrequency,
    fetchRepRoutes,
  };
}
