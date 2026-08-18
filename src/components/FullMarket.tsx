import { useEffect, useMemo, useState } from 'react';
import type { CatalogEvent, FancyMarket, OddsMarket } from '../types';
import {
  getBmOdds,
  getEventDetail,
  getFancyOdds,
  ApiError,
} from '../lib/api';
import { isBmMarket, isFancyMarket, upsertMarkets } from '../lib/odds';
import { fancyIsBallRunning, fancyLockLabel } from '../lib/marketStatus';
import { BmMarketPanel } from './BmMarketPanel';
import { PriceCell } from './PriceCell';
import { useCustomerStream } from '../hooks/useCustomerStream';

type MarketTab = 'bookmaker' | 'fancy';

interface Props {
  event: CatalogEvent;
  apiBaseUrl: string;
  apiKey: string;
  wsUrl: string;
  onBack: () => void;
}

function FancyBlock({ markets }: { markets: FancyMarket[] }) {
  if (!markets.length) {
    return <div className="waiting">No fancy odds in Redis for this event.</div>;
  }

  return (
    <div className="fancy-board">
      <div className="fancy-cols">
        <span className="fancy-cols-sel">Market</span>
        <span>No</span>
        <span>Yes</span>
      </div>
      {markets.map((m) => {
        const lock = fancyLockLabel(m);
        const ballRunning = !lock && fancyIsBallRunning(m);
        const overlay = lock || (ballRunning ? 'Ball Running' : null);
        const key =
          m.source_market_id ||
          String((m as { id?: string | number }).id ?? m.name);
        return (
          <div className="fancy-row" key={key}>
            <div className="fancy-name">{m.name}</div>
            <div className={`fancy-odds${overlay ? ' has-overlay' : ''}`}>
              <PriceCell kind="lay" price={m.l1} volume={m.ls1} />
              <PriceCell kind="back" price={m.b1} volume={m.bs1} />
              {overlay ? <div className="odds-overlay">{overlay}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function sortBm(
  a: { name?: string; type?: string; odd_type?: string },
  b: { name?: string; type?: string; odd_type?: string },
): number {
  const rank = (m: { name?: string; type?: string }) => {
    const type = String(m.type || '').toUpperCase();
    const name = String(m.name || '').toUpperCase();
    if (type === 'MATCH_ODDS' || name === 'BOOKMAKER' || name === 'MATCH ODDS') return 0;
    if (type === 'MINI_BOOKMAKER' || name.includes('MINI')) return 1;
    if (type === 'EXTRA_BOOKMAKER') return 2;
    return 3;
  };
  const d = rank(a) - rank(b);
  if (d !== 0) return d;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

/**
 * Event detail: show WS odds_snapshot immediately, then apply odds_update.
 * REST BM/fancy is optional fill — must not block the UI.
 */
export function FullMarket({
  event,
  apiBaseUrl,
  apiKey,
  wsUrl,
  onBack,
}: Props) {
  const defaultTab: MarketTab = event.has_bm ? 'bookmaker' : 'fancy';
  const [tab, setTab] = useState<MarketTab>(defaultTab);
  const [restMarkets, setRestMarkets] = useState<Map<string, OddsMarket>>(
    () => new Map(),
  );
  const [marketMetaCount, setMarketMetaCount] = useState(0);
  const [restLoading, setRestLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Optional REST snapshot (non-blocking for UI once WS has data)
  useEffect(() => {
    let cancelled = false;
    setRestMarkets(new Map());
    setRestLoading(true);
    setError(null);

    async function loadRest() {
      try {
        const detailP = getEventDetail(apiBaseUrl, apiKey, event.id).catch(
          () => null,
        );
        const bmP = event.has_bm
          ? getBmOdds(apiBaseUrl, apiKey, event.id)
          : Promise.resolve({ data: [] as never[] });
        const fancyP =
          event.has_fancy || event.has_fancy_markets
            ? getFancyOdds(apiBaseUrl, apiKey, event.id)
            : Promise.resolve({ data: [] as never[] });

        const [detail, bm, fancy] = await Promise.all([detailP, bmP, fancyP]);
        if (cancelled) return;

        if (detail && Array.isArray(detail.markets)) {
          setMarketMetaCount(detail.markets.length);
        }

        let bag = new Map<string, OddsMarket>();
        bag = upsertMarkets(bag, bm.data);
        bag = upsertMarkets(bag, fancy.data);
        setRestMarkets(bag);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? `${e.code || e.status}: ${e.message}`
            : e instanceof Error
              ? e.message
              : 'Failed to load REST odds',
        );
      } finally {
        if (!cancelled) setRestLoading(false);
      }
    }

    void loadRest();
    return () => {
      cancelled = true;
    };
  }, [
    apiBaseUrl,
    apiKey,
    event.id,
    event.has_bm,
    event.has_fancy,
    event.has_fancy_markets,
  ]);

  const sourceEventId = Number(event.source_event_id);

  const stream = useCustomerStream({
    wsUrl,
    apiKey,
    sourceEventIds: [sourceEventId],
    enabled: Number.isFinite(sourceEventId),
  });

  // Live WS is source of truth; REST only fills markets not yet seen on the socket.
  const markets = useMemo(() => {
    const live = stream.oddsByEvent.get(sourceEventId);
    if (live && live.size > 0) {
      const merged = new Map(live);
      for (const [k, v] of restMarkets) {
        if (!merged.has(k)) merged.set(k, v);
      }
      return merged;
    }
    return new Map(restMarkets);
    // revision/updateCount force a fresh read on every odds_snapshot / odds_update
  }, [
    restMarkets,
    stream.oddsByEvent,
    stream.revision,
    stream.updateCount,
    sourceEventId,
  ]);

  const bmList = useMemo(
    () => [...markets.values()].filter(isBmMarket).sort(sortBm),
    [markets],
  );
  const fancyList = useMemo(
    () => [...markets.values()].filter(isFancyMarket),
    [markets],
  );

  const hasOdds = markets.size > 0;
  // Show loading only until first odds arrive (prefer WS snapshot)
  const showLoading = !hasOdds && restLoading && stream.status !== 'error';

  const wsDot =
    stream.status === 'subscribed' || stream.status === 'authenticated'
      ? 'ok'
      : stream.status === 'connecting'
        ? 'warn'
        : stream.status === 'error'
          ? 'err'
          : '';

  return (
    <div className="detail-page">
      <div className="detail-head">
        <button type="button" className="ghost-btn" onClick={onBack}>
          ← Events
        </button>
        <h2 className="detail-title">{event.name}</h2>
        <div className="event-meta">
          {event.sport_name} · open{' '}
          {new Date(event.open_date).toLocaleString()} · source{' '}
          {event.source_event_id}
          {marketMetaCount ? ` · ${marketMetaCount} enabled markets` : ''}
        </div>
        <div className="detail-status">
          <span className="chip">
            <span className={`dot ${wsDot}`} />
            WS <strong>{stream.status}</strong>
            {stream.updateCount ? ` · ${stream.updateCount} updates` : ''}
          </span>
          {hasOdds ? (
            <span className="chip">
              Markets <strong>{markets.size}</strong>
            </span>
          ) : null}
        </div>
      </div>

      {error && !hasOdds ? <div className="error-box">{error}</div> : null}
      {stream.lastError ? (
        <div className="error-box">WS {stream.lastError}</div>
      ) : null}

      <div className="market-tabs">
        {event.has_bm || bmList.length ? (
          <button
            type="button"
            className={tab === 'bookmaker' ? 'active' : ''}
            onClick={() => setTab('bookmaker')}
          >
            Bookmaker ({bmList.length})
          </button>
        ) : null}
        {event.has_fancy ||
        event.has_fancy_markets ||
        fancyList.length ? (
          <button
            type="button"
            className={tab === 'fancy' ? 'active' : ''}
            onClick={() => setTab('fancy')}
          >
            Fancy ({fancyList.length})
          </button>
        ) : null}
      </div>

      {showLoading ? <div className="loading">Waiting for odds snapshot…</div> : null}

      {!showLoading && tab === 'bookmaker' ? (
        bmList.length ? (
          <div className="detail-markets">
            {bmList.map((m) => (
              <BmMarketPanel key={m.source_market_id} market={m} />
            ))}
          </div>
        ) : (
          <div className="waiting">No BM odds yet — waiting for snapshot/updates.</div>
        )
      ) : null}

      {!showLoading && tab === 'fancy' ? (
        <FancyBlock markets={fancyList} />
      ) : null}
    </div>
  );
}
