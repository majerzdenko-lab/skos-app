# SKoS — Scything Competition Management App

Web application for Slovenský kosecký spolok (SKoS) covering the full lifecycle of a scything competition: online registration → administration → plot draw → time measurement → results sheet.

## Prerequisites

- Node.js ≥ 20 (install via [nvm](https://github.com/nvm-sh/nvm) or [Volta](https://volta.sh))
- Docker Desktop (for local PostgreSQL)

## Local Development

### 1. Start the database

```bash
docker compose up -d
```

### 2. API

```bash
cd api
cp .env.example .env.local    # already done — edit values as needed
npm install
npm run db:generate           # generate Prisma client
npm run db:migrate            # create the DB schema
npm run dev                   # starts on http://localhost:3001
```

### 3. Web (separate terminal)

```bash
cd web
npm install
npm run dev                   # starts on http://localhost:5173
```

The web dev server proxies `/api` and `/socket.io` to `localhost:3001` automatically.

## Environment variables

### API (`api/.env.local`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string for access tokens |
| `JWT_REFRESH_SECRET` | Different long random string for refresh tokens |
| `FRONTEND_URL` | URL of the web app (for CORS) |
| `RESEND_API_KEY` | API key from resend.com |
| `EMAIL_FROM` | Sender address, e.g. `SKoS <sutaze@skos.sk>` |

### Web (`web/.env.local`)

Leave `VITE_API_URL` and `VITE_WS_URL` empty during local development — the Vite proxy handles routing.

## Deployment (Railway)

1. Push this repo to GitHub
2. Create a Railway project with 3 services: PostgreSQL, API (`/api`), Web (`/web`)
3. Set environment variables in the Railway dashboard (see `api/.env.example`)
4. Railway auto-deploys on every push to `main`

## Architecture

```
api/
  src/
    routes/     — Express routers (auth, events, categories, participants, entries, teams, users, export, public)
    middleware/ — authenticate, requireEventRole, validate
    services/   — ranking (pure), email (Resend), pdf (@react-pdf/renderer)
    data/       — defaultCategories template
  prisma/       — schema + migrations

web/
  src/
    pages/      — public (register, results, about, privacy) + admin (dashboard, setup, registration, draw, judging, results)
    components/ — Layout, Footer, Stopwatch, TimeInput, PenaltyPicker, ResultsSheet
    stores/     — authStore (Zustand), socketStore (Socket.io)
    hooks/      — useStopwatch, useEventSocket
    api/        — Axios client + typed endpoint wrappers
```

## Key flows

- **Auth:** JWT access token (15m) in memory + refresh token (30d) in httpOnly cookie
- **Real-time:** Socket.io room `event:{id}` — judges see each other's times live
- **Plot draw:** Fisher-Yates shuffle per category (pools are independent)
- **Rankings:** `baseTime + penalty` ascending; DNR last; ties share rank
- **Email:** Resend, fire-and-forget; unsubscribe via one-click token link

## Branding

All pages include the footer: _Softvér vytvoril Veselý Kosec (veselykosec.sk) pre Slovenský kosecký spolok_
