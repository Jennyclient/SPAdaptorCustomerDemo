import { useEffect, useRef, useState } from 'react';
import { formatPrice, formatVolume } from '../lib/odds';

export function PriceCell({
  price,
  volume,
  kind,
  suspended,
  statusLabel,
}: {
  price?: string | number | null;
  volume?: string | number | null;
  kind: 'back' | 'lay';
  suspended?: boolean;
  statusLabel?: string | null;
}) {
  const [flash, setFlash] = useState(false);
  const prevPrice = useRef<string | number | null | undefined>(price);

  useEffect(() => {
    if (
      prevPrice.current !== undefined &&
      prevPrice.current !== price &&
      price != null &&
      price !== ''
    ) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 450);
      prevPrice.current = price;
      return () => window.clearTimeout(t);
    }
    prevPrice.current = price;
  }, [price]);

  if (statusLabel) {
    return <div className="price status">{statusLabel}</div>;
  }
  if (suspended) {
    return <div className="price status">Suspended</div>;
  }
  const p = formatPrice(price);
  const empty = p === '—';
  return (
    <div
      className={`price ${kind}${empty ? ' empty' : ''}${flash ? ' flash' : ''}`}
    >
      <span>{p}</span>
      {!empty && formatVolume(volume) ? <small>{formatVolume(volume)}</small> : null}
    </div>
  );
}
