export type DayTab = 'all' | 'today' | 'tomorrow' | 'custom';

export interface DemoConfig {
  apiBaseUrl: string;
  wsUrl: string;
  apiKey: string;
}

export interface CatalogEvent {
  id: string;
  source_event_id: number;
  name: string;
  sport_name: string;
  sport_id?: number | null;
  open_date: string;
  has_bm: boolean;
  has_fancy: boolean;
  has_fancy_markets: boolean;
  competition_name?: string;
  league_name?: string;
}

export interface SportOption {
  /** Display name from API `sport_name` */
  name: string;
  /** API `sport_id` when present (same as upstream event_type_id) */
  id: number | null;
}

export interface BmRunner {
  selection_id: number | string;
  name: string;
  sort?: number;
  status?: string;
  back_price?: string | number;
  lay_price?: string | number;
  back_volume?: string | number;
  lay_volume?: string | number;
  back_1_price?: string | number;
  back_2_price?: string | number;
  lay_1_price?: string | number;
  lay_2_price?: string | number;
  back_1_volume?: string | number;
  back_2_volume?: string | number;
  lay_1_volume?: string | number;
  lay_2_volume?: string | number;
}

export interface BmMarket {
  event_id: string;
  source_event_id: number;
  market_id: string;
  market_kind: 'BM';
  source_market_id: string;
  name: string;
  odd_type?: string;
  status?: string;
  type?: string;
  min_bet?: string | number;
  max_bet?: string | number;
  bet_allow?: string | number;
  runners: BmRunner[];
  source_last_updated?: number;
}

export interface FancyMarket {
  event_id?: string;
  source_event_id?: number;
  market_id?: string;
  market_kind: 'FANCY';
  source_market_id: string;
  /** Upstream fancy id (WS snapshot often sends this instead of source_market_id) */
  id?: number | string;
  name: string;
  odd_type?: string;
  type_code?: number;
  b1?: string | number;
  bs1?: string | number;
  l1?: string | number;
  ls1?: string | number;
  status1?: string;
  bet_allow?: string | number;
  min_bet?: string | number;
  max_bet?: string | number;
  source_last_updated?: number;
}

export type OddsMarket = BmMarket | FancyMarket;

export type WsStatus =
  | 'idle'
  | 'connecting'
  | 'authenticated'
  | 'subscribed'
  | 'error'
  | 'closed';
