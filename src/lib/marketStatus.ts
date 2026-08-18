import type { BmRunner, FancyMarket } from '../types';

function statusUpper(value: unknown): string {
  return String(value || '').toUpperCase();
}

/**
 * Only hard-lock UI (hide prices) for Suspended/Closed.
 * BALL_RUNNING often still carries live back/lay — show prices; badge separately.
 */
export function runnerLockLabel(r: BmRunner): string | null {
  const s = statusUpper(r.status);
  if (s.includes('SUSPEND')) return 'Suspended';
  if (s === 'CLOSED') return 'Closed';
  return null;
}

export function runnerIsBallRunning(r: BmRunner): boolean {
  return statusUpper(r.status).includes('BALL');
}

/** Hard lock for fancy: Suspended / Closed — replace No/Yes with one bar. */
export function fancyLockLabel(m: FancyMarket): string | null {
  const s = statusUpper(m.status1);
  if (s.includes('SUSPEND')) return 'Suspended';
  if (s === 'CLOSED' || s === 'SETTLED' || s === 'ABANDONED' || s === 'INACTIVE') {
    if (s === 'CLOSED') return 'Closed';
    if (s === 'SETTLED') return 'Settled';
    if (s === 'ABANDONED') return 'Abandoned';
    if (s === 'INACTIVE') return 'Inactive';
  }
  return null;
}

/** Velki-style: Ball Running overlays prices; prices stay visible underneath. */
export function fancyIsBallRunning(m: FancyMarket): boolean {
  return statusUpper(m.status1).includes('BALL');
}

/** @deprecated use fancyLockLabel — kept for any older call sites */
export function fancyStatusLabel(m: FancyMarket): string | null {
  return fancyLockLabel(m);
}

export function fancySuspended(m: FancyMarket): boolean {
  return Boolean(fancyLockLabel(m));
}
