import type { BmMarket, BmRunner } from '../types';
import { runnerIsBallRunning, runnerLockLabel } from '../lib/marketStatus';
import { PriceCell } from './PriceCell';

function sortRunners(runners: BmRunner[]): BmRunner[] {
  return [...runners].sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0));
}

function isBackOnly(market: BmMarket): boolean {
  return String(market.odd_type || '')
    .toUpperCase()
    .includes('BACK_ONLY');
}

interface Props {
  market: BmMarket;
}

/** One bookmaker market: header + runners with Back/Lay (overlay for Suspended / Ball Running). */
export function BmMarketPanel({ market }: Props) {
  const runners = sortRunners(market.runners || []);
  const backOnly = isBackOnly(market);
  const min = market.min_bet ?? '—';
  const max = market.max_bet ?? '—';
  const marketBallRunning = String(market.status || '')
    .toUpperCase()
    .includes('BALL');

  return (
    <section className="mkt">
      <div className="mkt-head">
        <div className="mkt-head-main">
          <span className="mkt-name">{market.name || 'Bookmaker'}</span>
          {market.type ? (
            <span className="mkt-badge">{String(market.type).replace(/_/g, ' ')}</span>
          ) : null}
          {backOnly ? <span className="mkt-badge">Back only</span> : null}
        </div>
        <div className="mkt-cols" aria-hidden>
          <span className="mkt-col-label back">Back</span>
          {!backOnly ? <span className="mkt-col-label lay">Lay</span> : null}
        </div>
      </div>

      <div className="mkt-body">
        {runners.map((r) => {
          const lock = runnerLockLabel(r);
          const ballRunning =
            !lock && (marketBallRunning || runnerIsBallRunning(r));
          const overlay = lock || (ballRunning ? 'Ball Running' : null);
          return (
            <div className="mkt-row" key={String(r.selection_id)}>
              <div className="mkt-sel">
                <span>{r.name}</span>
              </div>
              <div
                className={`mkt-prices${backOnly ? ' back-only' : ''}${
                  overlay ? ' has-overlay' : ''
                }`}
              >
                <PriceCell
                  kind="back"
                  price={r.back_price ?? r.back_1_price}
                  volume={r.back_volume ?? r.back_1_volume}
                />
                {!backOnly ? (
                  <PriceCell
                    kind="lay"
                    price={r.lay_price ?? r.lay_1_price}
                    volume={r.lay_volume ?? r.lay_1_volume}
                  />
                ) : null}
                {overlay ? <div className="odds-overlay">{overlay}</div> : null}
              </div>
            </div>
          );
        })}
        {!runners.length ? <div className="mkt-empty">No runners</div> : null}
      </div>

      <div className="mkt-foot">
        <span>min {String(min)}</span>
        <span>max {String(max)}</span>
      </div>
    </section>
  );
}
