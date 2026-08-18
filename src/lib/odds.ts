import type { BmMarket, BmRunner, FancyMarket, OddsMarket } from '../types';

export function isBmMarket(m: OddsMarket): m is BmMarket {
  if (m.market_kind === 'BM') return true;
  if (m.market_kind === 'FANCY') return false;
  return 'runners' in m && Array.isArray((m as BmMarket).runners);
}

export function isFancyMarket(m: OddsMarket): m is FancyMarket {
  if (m.market_kind === 'FANCY') return true;
  if (m.market_kind === 'BM') return false;
  return 'b1' in m || 'status1' in m || 'type_code' in (m as object);
}

function resolveMarketKind(raw: Record<string, unknown>): 'BM' | 'FANCY' {
  const explicit = String(raw.market_kind || '').toUpperCase();
  if (explicit === 'BM' || explicit === 'FANCY') return explicit;
  if (Array.isArray(raw.runners) || (raw.runners && typeof raw.runners === 'object')) {
    return 'BM';
  }
  return 'FANCY';
}

/** Collect every id alias so snapshot/update/REST collapse to one market. */
function collectAliases(raw: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ['source_market_id', 'm_id', 'id'] as const) {
    const v = raw[key];
    if (v == null || String(v) === '') continue;
    const s = String(v);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Prefer catalog `source_market_id`, then upstream `m_id`, then fancy numeric `id`.
 * (BM payloads often include both `source_market_id` and a different `m_id`.)
 */
function resolveSourceMarketId(raw: Record<string, unknown>): string {
  for (const key of ['source_market_id', 'm_id', 'id'] as const) {
    const v = raw[key];
    if (v != null && String(v) !== '') return String(v);
  }
  return '';
}

function coerceRunners(raw: unknown): BmRunner[] | null {
  if (Array.isArray(raw)) return raw as BmRunner[];
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, BmRunner>);
  }
  return null;
}

function mergeOneMarket(
  prev: OddsMarket | undefined,
  raw: Record<string, unknown>,
  kind: 'BM' | 'FANCY',
  sourceId: string,
): OddsMarket {
  const base = {
    ...(prev as object | undefined),
    ...raw,
    market_kind: kind,
    source_market_id: sourceId,
  };

  if (kind === 'BM') {
    const incomingRunners = coerceRunners(raw.runners);
    const prevRunners = prev && isBmMarket(prev) ? prev.runners : undefined;
    const runners =
      incomingRunners && incomingRunners.length > 0
        ? incomingRunners
        : prevRunners && prevRunners.length > 0
          ? prevRunners
          : incomingRunners || [];
    return { ...base, runners } as BmMarket;
  }

  return base as FancyMarket;
}

/** Merge REST / WS markets. Key = `${market_kind}:${source_market_id}`. */
export function upsertMarkets(
  prev: Map<string, OddsMarket>,
  incoming: OddsMarket | OddsMarket[] | null | undefined,
): Map<string, OddsMarket> {
  if (!incoming) return prev;
  const next = new Map(prev);
  const list = Array.isArray(incoming) ? incoming : [incoming];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as unknown as Record<string, unknown>;
    const kind = resolveMarketKind(raw);
    const aliases = collectAliases(raw);
    const sourceId = resolveSourceMarketId(raw);
    if (!sourceId) continue;

    // Drop alias keys so m_id vs source_market_id never create duplicates.
    let existing: OddsMarket | undefined;
    for (const a of aliases) {
      const k = `${kind}:${a}`;
      if (next.has(k)) {
        existing = next.get(k);
        if (k !== `${kind}:${sourceId}`) next.delete(k);
      }
    }

    const key = `${kind}:${sourceId}`;
    next.set(key, mergeOneMarket(existing, raw, kind, sourceId));
  }
  return next;
}

export function formatPrice(value: string | number | undefined | null): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  return Number.isInteger(n) ? String(n) : String(n);
}

export function formatVolume(value: string | number | undefined | null): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function competitionLabel(event: {
  competition_name?: string;
  league_name?: string;
  sport_name?: string;
}): string {
  return event.competition_name || event.league_name || event.sport_name || 'Matches';
}

/**
 * Customer API has no `in_play` flag. Treat as “likely live” only when
 * open_date is recent (started within ~8h, not far in the future).
 */
export function isLikelyLive(openDate: string, now = Date.now()): boolean {
  const t = Date.parse(openDate);
  if (!Number.isFinite(t)) return false;
  const eightHours = 8 * 60 * 60 * 1000;
  return t <= now + 15 * 60_000 && t >= now - eightHours;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Unique sports from a catalog page (customer API has no sports list endpoint). */
export function sportsFromEvents(
  events: Array<{ sport_name?: string; sport_id?: number | null }>,
): Array<{ name: string; id: number | null }> {
  const map = new Map<string, { name: string; id: number | null }>();
  for (const e of events) {
    const name = (e.sport_name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name,
        id: e.sport_id == null ? null : Number(e.sport_id),
      });
    } else if (existing.id == null && e.sport_id != null) {
      existing.id = Number(e.sport_id);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Local calendar day as YYYY-MM-DD for `<input type="date">`. */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local calendar day. */
export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Build date query params matching BE `open_date` filters. */
export function dayTabToDateRange(
  tab: 'all' | 'today' | 'tomorrow' | 'custom',
  now = new Date(),
  custom?: { from?: string; to?: string },
): { fromDate?: string; toDate?: string } {
  if (tab === 'today') {
    return {
      fromDate: startOfDay(now).toISOString(),
      toDate: endOfDay(now).toISOString(),
    };
  }
  if (tab === 'tomorrow') {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return {
      fromDate: startOfDay(t).toISOString(),
      toDate: endOfDay(t).toISOString(),
    };
  }
  if (tab === 'custom') {
    const from = custom?.from ? parseDateInput(custom.from) : null;
    const to = custom?.to ? parseDateInput(custom.to) : null;
    const range: { fromDate?: string; toDate?: string } = {};
    if (from) range.fromDate = startOfDay(from).toISOString();
    if (to) range.toDate = endOfDay(to).toISOString();
    return range;
  }
  return {};
}
