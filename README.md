# ClashDX Customer Demo

Whitelabel customer board — REST catalog + WebSocket live odds.

## Setup

```bash
cp .env.example .env
# set VITE_API_KEY=wl_live_…
npm install
npm run dev
```

Open http://localhost:5173

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001/v1/stream
VITE_API_KEY=wl_live_…
```

Restart `npm run dev` after any `.env` change.

## Layout

```text
src/
  App.tsx                 # Event list + filters
  components/
    MatchCard.tsx         # List row
    FullMarket.tsx        # Event detail (REST + WS)
    BmMarketPanel.tsx     # Back/Lay market table
    PriceCell.tsx
  hooks/useCustomerStream.ts
  lib/api.ts              # Customer REST
  lib/config.ts           # VITE_* env
  lib/odds.ts
  lib/marketStatus.ts
public/favicon.svg
```

See `SPAdaptorBackend/docs/guides/CUSTOMER_GUIDE.md` for API contracts.
