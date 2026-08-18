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

Production `npm run build` uses committed `.env.production` (API URLs). Set `VITE_API_KEY` as a CI/hosting secret — do not commit it.

## Deploy on Vercel

1. Push this folder (or the parent repo) to GitHub.
2. In [Vercel](https://vercel.com/new): **Add New → Project** → import the repo.
3. Set **Root Directory** to `sports/SPAdaptorCustomerDemo` if the repo is the ClashDx monorepo. Leave it empty if this folder is its own repo.
4. Framework Preset: **Vite**. Build `npm run build`, output `dist`.
5. **Settings → Environment Variables** — add for Production (and Preview if needed):

   | Name | Value |
   |---|---|
   | `VITE_API_KEY` | `wl_live_…` from admin create/rotate |

   URLs come from `.env.production`. Do not put the key in git.
6. Deploy. After changing env vars, **Redeploy** so Vite bakes them into the build.

CLI from this folder (after `npx vercel login`):

```bash
npx vercel env add VITE_API_KEY production
npx vercel --prod
```

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
