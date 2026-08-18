import { useCallback, useEffect, useMemo, useState } from 'react';
import { MatchCard } from './components/MatchCard';
import { FullMarket } from './components/FullMarket';
import { listEvents, ApiError } from './lib/api';
import { configReady, loadConfig } from './lib/config';
import {
  dayTabToDateRange,
  sportsFromEvents,
  toDateInputValue,
} from './lib/odds';
import type { CatalogEvent, DayTab, SportOption } from './types';

const config = loadConfig();

/**
 * Customer demo aligned with CUSTOMER_GUIDE §6:
 * 1) GET /v1/events (board)
 * 2–4) Event page: detail + odds/bm + odds/fancy + WS
 */
export default function App() {
  const ready = configReady(config);
  const [dayTab, setDayTab] = useState<DayTab>('all');
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date()));
  const [customTo, setCustomTo] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 7);
    return toDateInputValue(t);
  });
  const [sportKey, setSportKey] = useState<string | null>(null);
  const [availableSports, setAvailableSports] = useState<SportOption[]>([]);
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(
    () =>
      dayTabToDateRange(dayTab, new Date(), {
        from: customFrom,
        to: customTo,
      }),
    [dayTab, customFrom, customTo],
  );

  const load = useCallback(async () => {
    if (!ready) {
      setEvents([]);
      setAvailableSports([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await listEvents(config.apiBaseUrl, config.apiKey, {
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
        limit: 50,
      });

      const rows = res.data || [];
      const sports = sportsFromEvents(rows);
      setAvailableSports(sports);
      setSportKey((prev) => {
        if (prev == null) return null;
        return sports.some((s) => s.name.toLowerCase() === prev) ? prev : null;
      });
      setEvents(rows);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `${e.code || e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Failed to load events',
      );
      setEvents([]);
      setAvailableSports([]);
    } finally {
      setLoading(false);
    }
  }, [ready, dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleEvents = useMemo(() => {
    if (!sportKey) return events;
    return events.filter(
      (e) => (e.sport_name || '').toLowerCase() === sportKey,
    );
  }, [events, sportKey]);

  const selected =
    events.find((e) => e.id === selectedId) ||
    visibleEvents.find((e) => e.id === selectedId) ||
    null;

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogEvent[]>();
    for (const ev of visibleEvents) {
      const key = ev.sport_name || 'Other';
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [visibleEvents]);

  return (
    <div className="board">
      <header className="masthead">
        <button
          type="button"
          className="brand-block"
          onClick={() => setSelectedId(null)}
        >
          <div className="brand-kicker">Customer demo</div>
          <h1 className="brand-title">CLASHDX</h1>
          <p className="brand-sub">
            Live catalog &amp; odds for whitelabel partners — powered by ClashDX.
          </p>
        </button>

        <div className="mast-meta">
          <span className="chip">
            Events <strong>{visibleEvents.length}</strong>
            {loading ? ' · refreshing' : ''}
          </span>
          <button type="button" className="ghost-btn" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="rail">
          <h2>Sport</h2>
          <div className="rail-stack">
            <button
              type="button"
              className={`rail-btn${sportKey == null ? ' active' : ''}`}
              onClick={() => {
                setSelectedId(null);
                setSportKey(null);
              }}
            >
              All
            </button>
            {availableSports.map((s) => {
              const key = s.name.toLowerCase();
              return (
                <button
                  key={key}
                  type="button"
                  className={`rail-btn${sportKey === key ? ' active' : ''}`}
                  onClick={() => {
                    setSelectedId(null);
                    setSportKey(key);
                  }}
                >
                  {s.name}
                </button>
              );
            })}
            {!loading && ready && !availableSports.length ? (
              <p className="rail-empty">No sports in this date window</p>
            ) : null}
          </div>

          <h2>Open date</h2>
          <div className="rail-stack">
            {(
              [
                ['all', 'All'],
                ['today', 'Today'],
                ['tomorrow', 'Tomorrow'],
                ['custom', 'Custom'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rail-btn${dayTab === id ? ' active' : ''}`}
                onClick={() => {
                  setSelectedId(null);
                  setDayTab(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {dayTab === 'custom' ? (
            <div className="date-range">
              <label className="date-field">
                <span>From</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => {
                    setSelectedId(null);
                    setCustomFrom(e.target.value);
                  }}
                />
              </label>
              <label className="date-field">
                <span>To</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => {
                    setSelectedId(null);
                    setCustomTo(e.target.value);
                  }}
                />
              </label>
            </div>
          ) : null}
        </aside>

        <main className="main">
          {!ready ? (
            <div className="env-banner">
              Set <code>VITE_API_KEY</code> in <code>.env</code>, then restart{' '}
              <code>npm run dev</code>.
            </div>
          ) : null}

          {error ? <div className="error-box">{error}</div> : null}

          {selected ? (
            <FullMarket
              event={selected}
              apiBaseUrl={config.apiBaseUrl}
              apiKey={config.apiKey}
              wsUrl={config.wsUrl}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <>
              {ready && loading && !events.length ? (
                <div className="loading">Loading events…</div>
              ) : null}
              {ready && !loading && !error && !visibleEvents.length ? (
                <div className="empty">
                  No enabled events for this filter. Widen the date range or enable
                  events in admin.
                </div>
              ) : null}

              {grouped.map(([sportName, rows]) => (
                <section key={sportName} className="sport-block">
                  <div className="sport-heading">
                    <h3>{sportName}</h3>
                    <span>{rows.length} events</span>
                  </div>
                  <div className="event-grid">
                    {rows.map((ev) => (
                      <MatchCard
                        key={ev.id}
                        event={ev}
                        onOpen={() => setSelectedId(ev.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
