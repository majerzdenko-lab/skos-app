# SKoS Implementation Checklist

## Acceptance Criteria
- Auth (register/login/refresh/logout) works end-to-end
- Event + Category + Participant CRUD works
- Public registration form works when event status = REGISTRATION
- Plot draw assigns unique numbers per category
- Judging screen records times, real-time sync via Socket.io
- Rankings computed correctly (ties, DNR)
- Results sheet renders identically to PDF template
- PDF and CSV export work
- Email notifications sent via Resend on category close
- All role guards enforced (401/403)
- Rate limiting applied
- Deployed on Railway

## Working Notes
- TypeScript throughout (both API and web)
- Refresh token in httpOnly cookie (path=/api/auth)
- Plot pools are per-category (independent 1–N)
- requireEventRole checks EventUser table per event
- Entry.totalTime = baseTime + penalty (computed, not stored)
- Unsubscribe token generated lazily (crypto.randomUUID)

---

## Slice 1 — Foundation ✓
- [x] docker-compose.yml
- [x] api/package.json + tsconfig.json + railway.toml
- [x] api/prisma/schema.prisma
- [x] api/src/prisma.ts, app.ts, index.ts, socket.ts
- [x] api/src/middleware/authenticate.ts, requireRole.ts, validate.ts
- [x] api/src/routes/auth.ts
- [x] web/package.json + tsconfig.json + vite.config.ts + tailwind.config.ts
- [x] web/src/main.tsx + App.tsx
- [x] web/src/stores/authStore.ts + socketStore.ts
- [x] web/src/pages/admin/Login.tsx

## Slice 2 — Event + Category + Participant ✓
- [x] api/src/routes/events.ts
- [x] api/src/routes/categories.ts
- [x] api/src/routes/participants.ts
- [x] api/src/routes/public.ts
- [x] api/src/data/defaultCategories.ts
- [x] web/src/pages/admin/Dashboard.tsx
- [x] web/src/pages/admin/EventSetup.tsx
- [x] web/src/pages/admin/Registration.tsx
- [x] web/src/pages/public/Register.tsx

## Slice 3 — Plot Draw ✓
- [x] api/src/routes/entries.ts (draw endpoints)
- [x] web/src/pages/admin/Draw.tsx

## Slice 4 — Judging + Real-time ✓
- [x] api/src/routes/entries.ts (PATCH + close)
- [x] web/src/pages/admin/Judging.tsx
- [x] web/src/components/Stopwatch.tsx
- [x] web/src/hooks/useStopwatch.ts
- [x] web/src/hooks/useEventSocket.ts

## Slice 5 — Rankings + Results Sheet ✓
- [x] api/src/services/ranking.ts
- [x] web/src/components/ResultsSheet.tsx
- [x] web/src/pages/admin/ResultsAdmin.tsx
- [x] web/src/pages/public/Results.tsx

## Slice 6 — PDF + CSV ✓
- [x] api/src/services/pdf.ts
- [x] api/src/routes/export.ts

## Slice 7 — Email ✓
- [x] api/src/services/email.ts

## Slice 8 — Polish ✓
- [x] Security headers, rate limits (in app.ts)
- [x] Footer, About, Privacy, Unsubscribe pages
- [x] Print CSS in index.css

## Next Steps (to run)
- Install Node.js (via nvm or Volta)
- Run: docker compose up -d
- Run: cd api && npm install && npm run db:migrate && npm run dev
- Run: cd web && npm install && npm run dev
- Test auth flow end-to-end
- Copy logo.png to web/public/ for favicon
