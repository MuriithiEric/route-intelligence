export interface TTMSummary {
  id: string;
  name: string;
  raw_name: string;
  role: string;
  total_visits: number;
  unique_shops: number;
  unique_routes: number;
  primary_region: string;
  regions_covered: string;
  avg_duration: number;
  coverage_pct: number;
  field_days: number;
  visits_per_day: number;
  last_active: string;
  rep_status?: string;
}

export interface UserGroup {
  category: string;
  active_users: number;
  total_visits: number;
  unique_shops: number;
  coverage_pct: number;
  field_days: number;
  active_rep_count?: number;
  inactive_rep_count?: number;
}

export interface RouteSummary {
  route_id: string;
  route_name: string;
  rep_name: string;
  category: string;
  visits: number;
  shops: number;
  primary_region: string;
}

export interface UserGroupRegion {
  category: string;
  region: string;
  visits: number;
  unique_shops: number;
  unique_reps: number;
  coverage_pct: number;
}

export interface Visit {
  id: string;
  shop_id: string;
  shop_name: string;
  rep_id: string;
  rep_name: string;
  category: string;
  region: string;
  route_name: string;
  route_id: string;
  lat: number;
  lng: number;
  check_in: string;
  check_out: string;
  duration: number;
  status: string;
  route_type: string;
}

export interface Customer {
  id: string;
  name: string;
  cat: string;
  tier: string;
  region: string;
  loc: string;
  channel: string;
  territory: string;
  lat: number;
  lng: number;
  last_visit: string;
  last_sale: string;
  phone: string;
}

export interface VisitFrequency {
  rep_name: string;
  shop_id: string;
  visit_count: number;
  first_visit: string;
  last_visit: string;
}

export interface WeeklySummary {
  year: number;
  week: number;
  category: string;
  total_visits: number;
  unique_shops: number;
  unique_reps: number;
}

export interface DailyActivity {
  rep_name: string;
  category: string;
  date: string;
  day_start: string;
  day_end: string;
  visits_that_day: number;
  shops_that_day: number;
}

export interface RepProfile {
  name: string;
  category: string;
  total_visits: number;
  unique_shops: number;
  unique_routes: number;
  primary_region: string;
  regions_covered: string;
  avg_duration: number;
  coverage_pct: number;
  field_days: number;
  visits_per_day: number;
  rep_status?: string;
}

export interface UserGroupPeople {
  category: string;
  region: string;
  rep_name: string;
  visits: number;
}

export type Tier = 'DISTRIBUTOR' | 'KEY ACCOUNT' | 'HUB' | 'STOCKIST' | 'MODERN TRADE' | 'GENERAL TRADE';
export type Region = 'NAIROBI' | 'NORTH RIFT' | 'SOUTH RIFT' | 'CENTRAL' | 'LAKE' | 'COAST';

export const GROUP_COLOURS: Record<string, string> = {
  'GT ATMs': '#C0392B',
  'TTMS': '#E07B39',
  'BIDCO RTM': '#6B4C9A',
  'BIDCO VAN SALES': '#1565C0',
  'ZAYN VAN SALES': '#1976D2',
  'RHOD': '#C9963E',
  'SUNTORY RTM': '#0E8C7A',
  'MT ATMS': '#558B2F',
  'MT TTMS': '#6D4C41',
  'MT RHOD': '#37474F',
};

export const TIER_COLOURS: Record<string, string> = {
  'DISTRIBUTOR':  '#C0392B',
  'KEY ACCOUNT':  '#7E57C2',
  'HUB':          '#C9963E',
  'STOCKIST':     '#E07B39',
  'MODERN TRADE': '#0E8C7A',
  'SUPERMARKET':  '#0E8C7A', // alias — same color as Modern Trade
  'GENERAL TRADE':'#F97316',
  'DISTRIBUTOR - FEEDS': '#E07B39', // shown as orange, separate from BIDCO distributors
};

export const REGIONS: Region[] = ['NAIROBI', 'NORTH RIFT', 'SOUTH RIFT', 'CENTRAL', 'LAKE', 'COAST'];

export interface FilterState {
  userGroup: string | null;
  fieldStaff: string | null;
  route: string | null;
  region: Region | null;
  dateFrom: string;
  dateTo: string;
  activeTier: Tier | null;
}

export interface CustomerCategoryCounts {
  DISTRIBUTOR: number;
  'KEY ACCOUNT': number;
  HUB: number;
  STOCKIST: number;
  'MODERN TRADE': number;
  'GENERAL TRADE': number;
  'DISTRIBUTOR - FEEDS': number;
  total: number;
}

export interface AppData {
  ttmSummary: TTMSummary[];
  userGroups: UserGroup[];
  routeSummary: RouteSummary[];
  userGroupRegions: UserGroupRegion[];
  customerCounts: CustomerCategoryCounts | null;
  routeCount: number | null;
  shopsVisited: number | null;
  loading: boolean;
}

export const DEFAULT_TIER_VISIBILITY: Record<string, boolean> = {
  DISTRIBUTOR: true,
  'KEY ACCOUNT': true,
  HUB: true,
  STOCKIST: true,
  SUPERMARKET: true,
  'GENERAL TRADE': true,
  'DISTRIBUTOR - FEEDS': true,
};

export interface LayerState {
  fieldStaff: boolean;
  customerUniverse: boolean;
  customerTier: Tier | null;
  routes: boolean;
  tierVisibility: Record<string, boolean>;
  showUnvisited: boolean;
}

export interface ShopVisitRow {
  shop_id: string;
  shop_name: string;
  cat: string | null;
  tier: string | null;
  region: string;
  check_in: string;
  duration: number;
  visit_count: number;
  first_visit: string;
  last_visit: string;
}
