import type { CatalogEvent } from '../types';
import { competitionLabel, isLikelyLive } from '../lib/odds';

interface Props {
  event: CatalogEvent;
  onOpen: () => void;
}

/** Board list row — no odds calls; open event for markets (§6). */
export function MatchCard({ event, onOpen }: Props) {
  const live = isLikelyLive(event.open_date);

  return (
    <button type="button" className="event-card event-card-simple" onClick={onOpen}>
      <div className="event-card-top">
        <div className="event-name">{event.name}</div>
        {live ? <span className="live-tag">Live</span> : null}
      </div>
      <div className="event-meta">
        {competitionLabel(event)} ·{' '}
        {new Date(event.open_date).toLocaleString()} · #{event.source_event_id}
      </div>
      <div className="event-flags">
        {event.has_bm ? <span className="flag">BM</span> : null}
        {event.has_fancy || event.has_fancy_markets ? (
          <span className="flag">Fancy</span>
        ) : null}
        <span className="open-hint">Open markets ›</span>
      </div>
    </button>
  );
}
