# SKoS — Scything Competition Management App
### Specification for Claude Code

> **Language note:** This specification is written in English. All UI strings visible to end users (labels, buttons, emails, page titles) are in **Slovak**, as the application serves a Slovak-speaking audience.

---

## 1. Project Overview

A web application for **Slovenský kosecký spolok (SKoS)** covering the full lifecycle of a scything competition event: online participant registration → administration → plot draw → time measurement by judges → results sheet.

**Key requirements:**
- Multi-user, role-based access (admin, registrar, judge, competitor)
- Online registration available before and on the day of the event
- Judges measure and record times directly in the app
- Results sheet visually identical to the existing PDF template
- Each event has fully configurable categories and plots

---

## 2. Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js or Fastify
- **Database:** PostgreSQL (via Prisma ORM)
- **Auth:** JWT (access + refresh token), bcrypt for passwords
- **Real-time:** Socket.io (live time updates for all connected clients)
- **PDF export:** `@react-pdf/renderer` or html-pdf-node
- **Input validation:** Zod
- **Security:** helmet.js, express-rate-limit

### Frontend
- **Framework:** React + Vite
- **Routing:** React Router v6
- **State:** Zustand or React Query + Context
- **UI components:** custom (no heavy UI library), Tailwind CSS
- **Responsive design:** fully functional on mobile, tablet, and desktop — standard web browser, no native app
- **Print/PDF:** dedicated print CSS styles

### Repository structure (monorepo)
```
/
├── api/          ← Node.js backend
│   ├── src/
│   ├── prisma/
│   └── package.json
├── web/          ← React frontend
│   ├── src/
│   └── package.json
├── .github/
│   └── workflows/   ← optional CI (lint, tests)
└── README.md
```

### Local development
- Docker Compose for PostgreSQL only (simple `docker-compose.yml` with the DB service)
- API and web run locally via `npm run dev`
- `.env.local` for local environment variables

---

## 3. Deployment — Railway + GitHub

### Setup

**Repository:** GitHub (single monorepo)

**Railway project** contains 3 services:
1. **PostgreSQL** — Railway managed database (one click, automatic `DATABASE_URL`)
2. **API** — Node.js service, deployed from `/api` directory
3. **Web** — Static site or Node serve, deployed from `/web` directory

**Auto-deploy:** every push to `main` branch → Railway automatically deploys both services.

### Railway configuration

**`api/railway.toml`**
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npx prisma migrate deploy && node dist/index.js"
healthcheckPath = "/health"
```

**`web/railway.toml`**
```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npx serve dist -p $PORT"
```

### Environment variables (set in Railway dashboard)

**API service:**
```
DATABASE_URL        ← provided automatically by Railway PostgreSQL
JWT_SECRET          ← random long string
JWT_REFRESH_SECRET  ← different random string
FRONTEND_URL        ← URL of the web service (for CORS)
RESEND_API_KEY      ← API key from resend.com
EMAIL_FROM          ← e.g. "SKoS <sutaze@skos.sk>"
NODE_ENV            production
PORT                ← provided automatically by Railway
```

**Web service:**
```
VITE_API_URL        ← URL of the API service
VITE_WS_URL         ← URL of the API service (for Socket.io)
```

### Prisma migrations
Run automatically on every deploy (`prisma migrate deploy` in startCommand).
Development: `prisma migrate dev` locally.

---

## 4. Data Model (Prisma Schema)

```prisma
model Event {
  id          String      @id @default(cuid())
  name        String
  date        DateTime
  location    String
  edition     Int?
  status      EventStatus @default(SETUP)
  createdAt   DateTime    @default(now())

  categories   Category[]
  participants Participant[]
  eventUsers   EventUser[]
}

enum EventStatus {
  SETUP         // configuration before the event
  REGISTRATION  // online registration is open
  ACTIVE        // event day, timing in progress
  CLOSED        // results are final
}

model Category {
  id             String       @id @default(cuid())
  eventId        String
  event          Event        @relation(fields: [eventId], references: [id])
  name           String       // e.g. "Muži od 16 do 60 rokov Profi"
  order          Int          // display order
  plotDimensions String       // e.g. "10×1,8 m" — informational text
  plotCount      Int          // number of plots in this category (e.g. 23)
  scored         Boolean      @default(true)
  categoryType   CategoryType @default(INDIVIDUAL)

  entries Entry[]
  teams   Team[]
}

enum CategoryType {
  INDIVIDUAL
  TEAM
}

model Participant {
  id               String   @id @default(cuid())
  eventId          String
  event            Event    @relation(fields: [eventId], references: [id])
  firstName        String
  lastName         String
  city             String
  dateOfBirth      String?  // "DD.MM.YYYY" or "YYYY" — optional (some provide year only)
  email            String?  // optional — only if participant provides it and consents
  emailConsent     Boolean  @default(false)
  unsubscribeToken String?  @unique  // generated on first email send
  userId           String?  // link to User if registered online with an account
  user             User?    @relation(fields: [userId], references: [id])
  createdAt        DateTime @default(now())

  entries         Entry[]
  teamMemberships TeamMember[]
}

model Entry {
  id            String      @id @default(cuid())
  participantId String
  participant   Participant @relation(fields: [participantId], references: [id])
  categoryId    String
  category      Category    @relation(fields: [categoryId], references: [id])

  plotNumber    Int?     // null until draw

  // Base time measurement — two judges, two stopwatches
  time1         Int?     // judge 1 time (seconds)
  time2         Int?     // judge 2 time (seconds)
  baseTime      Int?     // agreed final time (seconds) — editable until category is closed
                         // auto-filled if time1 == time2, otherwise entered manually

  // Penalty — quality commission
  penalty       Int      @default(0)  // penalty seconds, editable until category is closed
  penaltyNote   String?               // reason (e.g. "vysoké strnisko")

  // computed: baseTime + penalty (calculated in API)
  dnr           Boolean  @default(false)  // did not run / disqualified
  rank          Int?     // computed after category is closed
  updatedAt     DateTime @updatedAt
}

model Team {
  id         String   @id @default(cuid())
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  name       String
  plotNumber Int?

  // Base time measurement — two judges, two stopwatches (same logic as Entry)
  time1       Int?
  time2       Int?
  baseTime    Int?

  penalty     Int      @default(0)
  penaltyNote String?
  rank        Int?
  updatedAt   DateTime @updatedAt

  members TeamMember[]
}

model TeamMember {
  id            String      @id @default(cuid())
  teamId        String
  team          Team        @relation(fields: [teamId], references: [id])
  participantId String
  participant   Participant @relation(fields: [participantId], references: [id])
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String?  // null if registered without account (public registration)
  firstName    String?
  lastName     String?
  createdAt    DateTime @default(now())

  eventRoles   EventUser[]
  participants Participant[]
}

model EventUser {
  id      String @id @default(cuid())
  userId  String
  user    User   @relation(fields: [userId], references: [id])
  eventId String
  event   Event  @relation(fields: [eventId], references: [id])
  role    Role

  @@unique([userId, eventId])
}

enum Role {
  ADMIN       // event owner, full access
  REGISTRAR   // can add/edit participants
  JUDGE       // can record times, run timing
  COMPETITOR  // can view own results and results sheet
}
```

---

## 5. Roles and Permissions

| Action | ADMIN | REGISTRAR | JUDGE | COMPETITOR |
|---|:---:|:---:|:---:|:---:|
| Create/edit event | ✓ | | | |
| Add/edit categories | ✓ | | | |
| Manage plots | ✓ | | | |
| Change event status | ✓ | | | |
| Add/edit participant | ✓ | ✓ | | |
| Delete participant | ✓ | | | |
| Plot draw | ✓ | ✓ | | |
| Start timing | ✓ | | ✓ | |
| Record base time | ✓ | | ✓ | |
| Record penalty | ✓ | | ✓ | |
| Close category | ✓ | | | |
| View results sheet | ✓ | ✓ | ✓ | ✓ (own + live) |
| Export PDF | ✓ | ✓ | | |
| Export CSV | ✓ | ✓ | | |
| Manage user roles | ✓ | | | |

---

## 6. API Endpoints

### Auth
```
POST   /api/auth/register          Register new user
POST   /api/auth/login             Login → JWT
POST   /api/auth/refresh           Refresh access token
POST   /api/auth/logout
```

### Events
```
GET    /api/events                 List events (admin: all; others: own only)
POST   /api/events                 Create event (admin)
GET    /api/events/:id             Event detail
PATCH  /api/events/:id             Edit event (admin)
PATCH  /api/events/:id/status      Change status (SETUP→REGISTRATION→ACTIVE→CLOSED)
```

### Categories
```
GET    /api/events/:id/categories
POST   /api/events/:id/categories
PUT    /api/events/:id/categories/:catId
DELETE /api/events/:id/categories/:catId
POST   /api/events/:id/categories/reorder    Drag-and-drop reordering
```

### Participants
```
GET    /api/events/:id/participants
POST   /api/events/:id/participants          Add participant (admin/registrar or public registration)
PUT    /api/events/:id/participants/:pid
DELETE /api/events/:id/participants/:pid     Admin only
```

### Plot Draw
```
POST   /api/events/:id/categories/:catId/draw-all    Draw all plots at once (random)
PATCH  /api/entries/:entryId/plot                    Manual plot number assignment
```

### Results / Entries
```
GET    /api/events/:id/categories/:catId/entries
PATCH  /api/entries/:entryId                         Record time1, time2, baseTime, penalty, dnr
POST   /api/events/:id/categories/:catId/close       Close category + compute rankings
```

### Teams
```
GET    /api/events/:id/categories/:catId/teams
POST   /api/events/:id/categories/:catId/teams
PUT    /api/teams/:teamId
PATCH  /api/teams/:teamId/result
```

### Users / Roles
```
GET    /api/events/:id/users                 List users on event
POST   /api/events/:id/users                 Invite user with role (by email)
PATCH  /api/events/:id/users/:userId         Change role
DELETE /api/events/:id/users/:userId         Remove access
```

### Email Notifications
```
POST   /api/events/:id/send-announcement     Send new event email to all opt-in participants (ADMIN only)
GET    /api/unsubscribe/:token               Unsubscribe from notifications (public, no auth)
```

### Public (no authentication)
```
GET    /api/events/:id/public                Public event info (name, date, status)
GET    /api/events/:id/registration-open     Is registration open? (boolean)
POST   /api/events/:id/register-public       Public online registration
GET    /api/events/:id/results               Public results (closed categories only)
```

### PDF Export
```
GET    /api/events/:id/pdf                         Full results sheet as PDF
GET    /api/events/:id/categories/:catId/pdf       Single category
```

### CSV Export / Import
```
GET    /api/events/:id/export/participants          Participant list (all categories)
GET    /api/events/:id/export/results               Results for all categories
GET    /api/events/:id/categories/:catId/export     Results for one category

POST   /api/events/:id/import/results               Import results from CSV
```

**Export format:** UTF-8 BOM, semicolon delimiter `;` (Excel-compatible)

**Participants CSV:**
```
Kategória;Meno;Priezvisko;Bydlisko;Dátum narodenia;Číslo políčka
Muži Profi;Majer;Zdenko;Strelníky;6.3.1986;11
```

**Results CSV:**
```
Kategória;Políčko;Meno;Priezvisko;Bydlisko;Dátum narodenia;Základný čas;Penalizácia;Výsledný čas;Poradie
Muži Profi;11;Majer;Zdenko;Strelníky;6.3.1986;0:47;0:05;0:52;11
```

**Import** — for recovering from offline backup:
- Accepts the same format as export
- Shows a preview of changes and row count before applying
- Validates time format and plot number existence
- Conflicts (plot already has a time) → warning, admin decides whether to overwrite

### WebSocket (Socket.io)
```
room: event:{eventId}
  → emit: entry:updated   { entryId, baseTime, penalty, result }
  → emit: entry:drawn     { entryId, plotNumber }
  → emit: event:status    { status }
  → emit: category:closed { categoryId, results[] }
```

---

## 7. Screens — Frontend

### Public (no login required)

**`/events/:id/register`** — Online registration
- Form fields: Meno, Priezvisko, Bydlisko, Dátum narodenia, Kategória (dropdown)
- Email (optional) + checkbox: `☐ Chcem dostávať informácie o výsledkoch a nových podujatiach`
- Only shown when `event.status === REGISTRATION`
- After submit: confirmation with registration summary
- Displayed when `event.status === REGISTRATION`; if ACTIVE, walk-in registration may remain open (admin setting)

**`/events/:id/results`** — Public live results
- Tabs per category
- Live updates via Socket.io during the event
- Closed categories: final rankings
- Active categories: live times (plot number + time only, no ranking yet)

### Admin (login required)

**`/login`** — Login

**`/dashboard`** — Event list
- Event cards with status indicator
- "Nové podujatie" button

**`/events/:id/setup`** — Event setup *(ADMIN)*
- Edit basic info: name, date, location, edition
- **Category management:**
  - Category list with drag-and-drop reordering
  - Form per category: Názov, Rozmery políčka (free text), Počet políčok, Typ (Individual/Team), Hodnotená (toggle)
  - Add / Edit / Delete
  - "Načítaj predvolenú šablónu" button (loads typical event categories)
- **Role management:** invite user by email → assign role
- **Event status control** (step-by-step: Príprava → Registrácia → Prebieha → Uzatvorené)

**`/events/:id/registration`** — Participant registration *(ADMIN, REGISTRAR)*
- Search field + participant list (filterable by category)
- Quick add form: Meno, Priezvisko, Bydlisko, Dátum nar., Kategória → Pridaj
- Participant count per category
- Edit / Delete per record
- TEAM categories: "Tímy" tab — compose teams from registered participants

**`/events/:id/draw`** — Plot draw *(ADMIN, REGISTRAR)*
- Tabs per category
- Per category: participant table with plot assignments
  - Undrawn: "Žrebuj" button (random selection from available numbers 1–N)
  - Drawn: plot number shown, editable (manual override)
  - "Vyžrebuj všetkých" button for the whole category at once
- Plot pool is per category — each category has its own independent set of plots 1–N

**`/events/:id/judging`** — Timing and result entry *(ADMIN, JUDGE)*
- Tabs per category
- **Category status bar:** Čaká / Prebieha / Uzatvorená
- Table sorted by plot number

**Table columns:**
```
Políčko | Meno | Stopky R1 | Stopky R2 | Základný čas | Penalizácia | Poznámka | Výsledný čas | DNR
```

**Base time measurement — two judges:**
- Each judge has their own column (Stopky R1, Stopky R2)
- Stopwatch: ▶ Štart button → running time → ⏹ Stop → saved to `time1` or `time2`
- Alternative: direct manual input in `m:ss` format (when judge used a physical stopwatch)
- If `time1 == time2` → `Základný čas` auto-filled, highlighted green
- If `time1 ≠ time2` → both fields highlight orange, `Základný čas` stays empty, must be entered manually
- `Základný čas` is always editable until category is closed

**Penalty — quality commission:**
- Quick buttons: `0:00 · 0:03 · 0:05 · 0:08 · 0:10 · 0:13 · 0:15 · 0:20 · 0:25 · 0:30` + custom input
- Optional `Poznámka` text field (reason, e.g. "vysoké strnisko")
- Penalty editable at any time until category is closed
- Can be entered by anyone with JUDGE or ADMIN role, independently from timing

**Výsledný čas:** auto-calculated (`baseTime + penalty`), always current
**DNR checkbox:** disqualified / did not finish — hides times on results sheet
**"Uzatvoriť kategóriu" button:** active only when every entry has `baseTime` or DNR checked → computes rankings

**`/events/:id/results-admin`** — Results for organizers *(ADMIN, REGISTRAR, JUDGE)*
- Identical view to public results sheet
- Buttons: **Export PDF** (full results) · **Export CSV** (for further processing)

---

## 8. Stopwatch (Timing Module)

Each judge controls their own stopwatch column (R1 or R2).
Multiple stopwatches can run simultaneously — each plot runs in parallel.

**Optimistic UI:**
The judge never waits for the server. The time appears on their screen immediately after pressing Stop — server sync happens in the background. If the connection drops temporarily, the time is stored locally and sent automatically when the connection is restored.

**Technical implementation:**
- Stopwatches are client-side (`Date.now()` at Start, `Date.now()` at Stop → difference = seconds)
- Accuracy ±1s — sufficient for scything competition
- On Stop: optimistic UI update first, then sync to server
- Offline fallback: store locally, sync on reconnect

**Handling stopwatch disagreement:**
- `time1 == time2` → green highlight, no action needed
- `time1 ≠ time2` → orange highlight, judge or admin enters agreed time manually into `Základný čas`
- Both original values (`time1`, `time2`) remain stored in the database for dispute resolution

---

## 9. Results Sheet — Format Specification

Visually identical to the existing PDF template (Kosenie pri salaši Cabaj-Čápor 2026).

**Page header (per category):**
```
[SKoS logo — right]     Event name (bold, large)
Kategória: [name]       [plot dimensions]       [Location, DD.MM.YYYY]
```

**Individual table:**
| Por. číslo | Meno | Bydlisko | Dátum narodenia | Číslo políčka | Základný čas (mm:ss) | Penalizácia (mm:ss) | Výsledný čas (mm:ss) |
|---|---|---|---|---|---|---|---|

**Team table:**
| Por. číslo | Názov družstva | Meno | Bydlisko | Číslo políčka | Základný čas | Penalizácia | Výsledný čas |
|---|---|---|---|---|---|---|---|
(Team members are separate rows; rank and times appear only on the first row of each team)

**Unscored category:**
Table without time columns; result field shows "nehodnotení".

**Print CSS:**
- Each category = `page-break-after: always`
- Table with fixed column widths
- Font: serif for results (e.g. Times New Roman)

---

## 10. Online Registration Flow

1. Admin creates event and configures categories
2. Admin switches status to `REGISTRATION` → public link `/events/:id/register` becomes active
3. Participant opens link, fills in form, submits
4. Record is saved as Participant with `categoryId`
5. Admin/registrar sees new records in real-time at `/events/:id/registration`
6. On the day of the event: registration may remain open for walk-ins
7. Admin switches to `ACTIVE` → registration closes by default (configurable)

---

## 11. Validation Rules

- Date of birth: `DD.MM.YYYY` or `YYYY` (year only — some participants provide only the year); field is optional
- Time: format `m:ss` or `mm:ss`, min `0:00`, max `99:59`
- Plot number: integer 1–N (N = `category.plotCount`)
- Each plot number can only be assigned once within a category
- Plot pools are independent across categories (plot 9 in children's category ≠ plot 9 in men's category)

---

## 12. Default Category Template

When admin creates a new event, they can load the default template:

```json
[
  { "name": "Deti do 16 rokov Profi", "plotDimensions": "5×1,5 m", "plotCount": 23, "categoryType": "INDIVIDUAL", "scored": true },
  { "name": "Ženy Profi", "plotDimensions": "10×1,8 m", "plotCount": 23, "categoryType": "INDIVIDUAL", "scored": true },
  { "name": "Muži od 16 do 60 rokov Profi", "plotDimensions": "10×1,8 m", "plotCount": 23, "categoryType": "INDIVIDUAL", "scored": true },
  { "name": "Muži nad 60 rokov Profi", "plotDimensions": "10×1,8 m", "plotCount": 23, "categoryType": "INDIVIDUAL", "scored": true },
  { "name": "Deti Hobby", "plotDimensions": "5×1 m", "plotCount": 23, "categoryType": "INDIVIDUAL", "scored": true },
  { "name": "Ženy Hobby", "plotDimensions": "5×1,5 m", "plotCount": 23, "categoryType": "INDIVIDUAL", "scored": true },
  { "name": "Muži do 60 rokov Hobby", "plotDimensions": "10×1,8 m", "plotCount": 23, "categoryType": "INDIVIDUAL", "scored": true },
  { "name": "Muži nad 60 rokov Hobby", "plotDimensions": "10×1,5 m", "plotCount": 23, "categoryType": "INDIVIDUAL", "scored": true },
  { "name": "Družstvá", "plotDimensions": "10×10 m", "plotCount": 10, "categoryType": "TEAM", "scored": true }
]
```

---

## 13. Email Notifications

### Email provider
**Resend** (`resend.com`) — recommended:
- Free tier: 3,000 emails/month, 100/day — sufficient for SKoS
- Simple Node.js integration (`npm install resend`)
- Reliable deliverability, no SMTP configuration required

Alternative: Mailgun or Brevo (similar free tiers).

### Triggers and email content

**1. Category results — triggered when judge closes a category**
- Trigger: `POST /api/events/:id/categories/:catId/close`
- Recipients: all participants in that category with email and `emailConsent = true`
- Subject: `Výsledky: [Názov kategórie] — [Názov podujatia]`
- Body:
  ```
  Dobrý deň, [Meno],

  kategória [Názov kategórie] na podujatí [Názov podujatia] bola uzatvorená.

  Vaše výsledky:
  Políčko: [číslo]
  Základný čas: [mm:ss]
  Penalizácia: [mm:ss]
  Výsledný čas: [mm:ss]
  Umiestnenie: [poradie]. miesto z [celkový počet] súťažiacich

  Celková výsledková listina: [link to public results]

  —
  Slovenský kosecký spolok
  Softvér: Veselý Kosec · veselykosec.sk
  ```

**2. New event announcement — triggered manually by admin**
- Trigger: admin clicks "Odoslať oznámenie" button after switching status to `REGISTRATION`
- API: `POST /api/events/:id/send-announcement`
- Recipients: all Participant records across all events with email and `emailConsent = true` (deduplicated by email address)
- Subject: `Nové podujatie: [Názov] — [Dátum]`
- Body:
  ```
  Dobrý deň,

  Slovenský kosecký spolok vypisuje nové podujatie:

  [Názov podujatia]
  Dátum: [DD.MM.YYYY]
  Miesto: [Miesto]

  Registrácia je otvorená:
  [link to registration form]

  Ak si neželáte dostávať tieto správy, odhláste sa tu:
  [unsubscribe link]

  —
  Slovenský kosecký spolok
  Softvér: Veselý Kosec · veselykosec.sk
  ```

### Unsubscribe
- Every email contains an unsubscribe link with a one-time token
- `GET /api/unsubscribe/:token` → sets `emailConsent = false`, shows confirmation page
- No login required, no form — one click

### Background sending
Emails must not slow down the API response — send asynchronously (fire-and-forget). For v1, `setImmediate` / async without awaiting Resend's response is sufficient.

---

## 14. Security and Personal Data Protection

### Application security

**HTTPS**
Railway provides SSL/TLS automatically for every deployment. All communication is encrypted — no configuration needed.

**Authentication**
- Passwords hashed with `bcrypt` (cost factor 12) — never stored in plain text
- JWT access token: 15-minute expiry
- JWT refresh token: 30-day expiry, stored in `httpOnly` cookie (not localStorage — protects against XSS)
- Refresh token is invalidated on the server at logout

**Rate limiting** (`express-rate-limit`)
```
Login:                10 attempts / 15 minutes / IP
Public registration:  20 requests / hour / IP
General API:          200 requests / minute / IP
```
Protects against brute-force attacks and registration spam.

**HTTP security headers** (`helmet.js`)
Automatically sets:
- `Content-Security-Policy` — blocks loading of external scripts
- `X-Frame-Options: DENY` — clickjacking protection
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` — enforces HTTPS

**CORS**
API accepts requests only from the frontend URL (set via `FRONTEND_URL` env var). No wildcard `*`.

**SQL injection**
Prisma ORM uses parameterized queries — direct SQL injection is not possible.

**Input validation**
`zod` — every API endpoint validates input data before processing. Invalid input returns `400 Bad Request` and never reaches the database.

**Environment variables**
No sensitive data (passwords, API keys, database URL) is ever in source code or the Git repository — exclusively via Railway environment variables.

---

### Personal Data Protection (GDPR)

The application processes personal data of natural persons (name, city, date of birth, email). GDPR applies in Slovakia.

**Data collected and why:**
| Data | Purpose | Legal basis |
|---|---|---|
| First name, last name | Identification at event, results sheet | Legitimate interest / contract |
| City | Results sheet (tradition of scything competitions) | Legitimate interest |
| Date of birth | Assignment to age category | Legitimate interest |
| Email | Notifications (only with explicit consent) | Consent |

**Data minimization**
- No additional data is collected (phone, ID number, full address...)
- Email is optional — collected only if participant provides it and checks the consent box

**Right to erasure**
- Admin can delete a participant and all their records
- Email/unsubscribe: one click via unsubscribe link
- After deletion, name on results sheet can optionally be replaced with an anonymized version (e.g. "J. N.") — configurable

**Data retention**
- Competition results are public records — no need to delete
- Emails and personal profiles: admin can manually delete inactive records

**Cookies**
- App uses only necessary cookies (session / refresh token)
- No analytics or marketing cookies
- No cookie banner required for necessary-only cookies

**Privacy policy**
Simple `/privacy` page accessible from the footer — explains what is collected, why, and participant rights. Text to be prepared by SKoS; the app displays it.

**Data location**
PostgreSQL on Railway (EU region — Frankfurt). Data does not leave the EU.

---

## 15. Branding and Attribution

The application is created by **Veselý Kosec** for **Slovenský kosecký spolok (SKoS)**.
This must be visible on all screens — public and admin.

### Footer (all pages)
Persistent footer at the bottom of every screen:

```
Softvér vytvoril Veselý Kosec (veselykosec.sk) pre Slovenský kosecký spolok
```

- "Veselý Kosec" is a clickable link to `https://veselykosec.sk` (opens in new tab)
- Subtle, unobtrusive design — footer must not visually compete with functional content
- Shown on the public registration page, results page, and the printed results sheet

### About page (`/about`)
Simple page accessible from the footer:

```
Aplikácia na správu koseckých podujatí

Vytvorené pre Slovenský kosecký spolok (SKoS)
Softvér: Veselý Kosec — veselykosec.sk

Verzia: [version number]
```

### PDF results sheet
In the footer of every printed page (small text):

```
Softvér: Veselý Kosec · veselykosec.sk
```

---

## 16. Planned Extensions (v2+)

### Season leaderboard
Cumulative points / times across events within a season. Public table per category. Requires linking participants across events (identified by name + date of birth, or user account).

---

## 17. Out of Scope

- Registration fees / payments
- Multilingual UI — Slovak only
