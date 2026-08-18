import { useEffect, useRef, useState } from 'react';
import type { OddsMarket, WsStatus } from '../types';
import { upsertMarkets } from '../lib/odds';

type OddsByEvent = Map<number, Map<string, OddsMarket>>;

interface Options {
  wsUrl: string;
  apiKey: string;
  sourceEventIds: number[];
  enabled: boolean;
}

function asSourceEventId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function useCustomerStream({
  wsUrl,
  apiKey,
  sourceEventIds,
  enabled,
}: Options) {
  const [status, setStatus] = useState<WsStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [oddsByEvent, setOddsByEvent] = useState<OddsByEvent>(() => new Map());
  const [updateCount, setUpdateCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<number>>(new Set());
  const desiredRef = useRef<number[]>(sourceEventIds);

  desiredRef.current = sourceEventIds.map(Number).filter(Number.isFinite);

  useEffect(() => {
    setOddsByEvent(new Map());
    setUpdateCount(0);
    setRevision(0);
  }, [wsUrl, apiKey]);

  useEffect(() => {
    if (!enabled || !apiKey || !wsUrl) {
      setStatus('idle');
      wsRef.current?.close();
      wsRef.current = null;
      subscribedRef.current = new Set();
      return;
    }

    let closed = false;
    let ws: WebSocket | null = null;

    // Defer open so React remounts / HMR can cancel without leaking sockets.
    const timer = window.setTimeout(() => {
      if (closed) return;
      setStatus('connecting');
      setLastError(null);

      const url = new URL(wsUrl);
      url.searchParams.set('api_key', apiKey);
      ws = new WebSocket(url.toString());
      wsRef.current = ws;

      const applyPayload = (sourceEventId: number, data: unknown) => {
        const list = Array.isArray(data) ? data : data ? [data] : [];
        setOddsByEvent((prev) => {
          const next = new Map(prev);
          const current = new Map(next.get(sourceEventId) ?? []);
          const merged = upsertMarkets(current, list as OddsMarket[]);
          next.set(sourceEventId, merged);
          return next;
        });
        setRevision((r) => r + 1);
      };

      const syncSubs = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const desired = new Set(desiredRef.current);
        const current = subscribedRef.current;
        const toSub = [...desired].filter((id) => !current.has(id));
        const toUnsub = [...current].filter((id) => !desired.has(id));

        if (toUnsub.length) {
          ws.send(
            JSON.stringify({
              action: 'unsubscribe',
              channels: toUnsub.map((id) => `event:${id}`),
            }),
          );
        }
        if (toSub.length) {
          ws.send(
            JSON.stringify({
              action: 'subscribe',
              channels: toSub.map((id) => `event:${id}`),
            }),
          );
        }
        subscribedRef.current = desired;
      };

      ws.onmessage = (ev) => {
        if (closed) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }

        const type = String(msg.type || '');

        if (type === 'authenticated') {
          setStatus('authenticated');
          syncSubs();
          return;
        }

        if (type === 'subscribed') {
          setStatus('subscribed');
          return;
        }

        if (type === 'odds_snapshot' || type === 'odds_update') {
          const sourceEventId = asSourceEventId(msg.source_event_id);
          if (sourceEventId == null) return;
          const kind = msg.market_kind;
          let payload = msg.data;
          // Force market_kind from envelope onto each row (updates always send it).
          if (payload && typeof payload === 'object' && !Array.isArray(payload) && kind) {
            payload = { ...(payload as object), market_kind: kind };
          } else if (Array.isArray(payload) && kind) {
            payload = payload.map((row) =>
              row && typeof row === 'object'
                ? { ...(row as object), market_kind: kind }
                : row,
            );
          }
          applyPayload(sourceEventId, payload);
          if (type === 'odds_update') setUpdateCount((c) => c + 1);
          return;
        }

        if (type === 'error') {
          const code = String(msg.code || 'ERROR');
          const message = String(msg.message || code);
          setLastError(`${code}: ${message}`);
          if (code === 'UNAUTHORIZED' || code === 'CONNECTION_LIMIT') {
            setStatus('error');
          }
        }
      };

      ws.onerror = () => {
        if (!closed) {
          setLastError('WebSocket connection error');
          setStatus('error');
        }
      };

      ws.onclose = () => {
        if (!closed) setStatus('closed');
        subscribedRef.current = new Set();
      };
    }, 150);

    return () => {
      closed = true;
      window.clearTimeout(timer);
      ws?.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [wsUrl, apiKey, enabled]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (status !== 'authenticated' && status !== 'subscribed') return;

    const desired = new Set(
      sourceEventIds.map(Number).filter((n) => Number.isFinite(n)),
    );
    const current = subscribedRef.current;
    const toSub = [...desired].filter((id) => !current.has(id));
    const toUnsub = [...current].filter((id) => !desired.has(id));

    if (toUnsub.length) {
      ws.send(
        JSON.stringify({
          action: 'unsubscribe',
          channels: toUnsub.map((id) => `event:${id}`),
        }),
      );
    }
    if (toSub.length) {
      ws.send(
        JSON.stringify({
          action: 'subscribe',
          channels: toSub.map((id) => `event:${id}`),
        }),
      );
    }
    subscribedRef.current = desired;
  }, [sourceEventIds, status]);

  return { status, lastError, oddsByEvent, updateCount, revision };
}
