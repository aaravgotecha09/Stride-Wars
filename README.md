# StrideWars

A working prototype of the StrideWars pitch: real-time multiplayer territory
capture driven by **simulated GPS** movement. Full front end + back end,
built to deploy as **frontend → Vercel** and **backend → Render**.

- `backend/` — Node.js + Express + Socket.io + MongoDB (via Mongoose).
  Accounts (callsign + password) persist in Mongo; live game state — the
  12×12 zone grid, in-field positions, capture/decay ticks — stays in
  memory for speed and is synced back to each player's Mongo document
  (XP, team) when they disconnect.
- `frontend/` — React + Vite. A login/signup screen, a "Deploy" screen once
  authenticated, then the live map: your player "walks" toward wherever you
  click (this is the simulated GPS — no real location permission is used),
  with zone ownership + leaderboard updating over a WebSocket connection.

## Accounts & MongoDB

New users sign up with a callsign + password (`POST /auth/signup`); existing
users sign in (`POST /auth/login`). Both return a JWT that the frontend
stores in `localStorage` and sends with every socket connection — the
backend rejects any socket that doesn't carry a valid token.

A user's **team is assigned once**, on their first deploy, and then stays
fixed on their Mongo document (`models/User.js`: `username`, `passwordHash`,
`team`, `xp`). XP earned in a session is written back to that document when
the player disconnects, so progress carries over between visits.

You'll need a MongoDB connection string. The free tier of
[MongoDB Atlas](https://www.mongodb.com/cloud/atlas) works fine for this —
create a cluster, add a database user, and copy the connection string into
`MONGODB_URI` (see `.env.example`). If `MONGODB_URI` is left unset, the
server still boots (useful for poking at the game state), but signup/login
will fail until it's configured.

## How the simulated GPS works

There's no device GPS involved. Click any cell on the map and your token
walks toward it at a fixed pace, streaming intermediate coordinates to the
server every ~120ms — the same shape of data a real GPS integration would
send. The backend enforces a max speed
(`MAX_SPEED_CELLS_PER_SEC` in `server.js`); a position update that implies
faster-than-running movement is rejected and the client gets an
`anticheat_flag` event, mirroring the "speed-based anti-cheat" feature from
the original deck.

## Game rules (tunable in `backend/server.js`)

- Every second, each zone checks who's standing in it.
- One team alone in a zone → capture meter fills; at 100 they own it and
  earn a capture bonus. Holding an owned zone earns steady XP.
- A different team alone in an owned zone → meter drains; hits 0 and the
  zone flips to the attacker.
- Multiple teams in the same cell → standoff, meter ticks down slowly.
- Empty zone → the owner's meter slowly decays (inactivity = losing ground).

## Power-ups (in-run items)

All four live in `backend/gameState.js` (tuning constants) and `backend/tick.js`
(the actual mechanics). The frontend exposes them via the **Power-Ups** panel
and the **Fitness Mode** panel.

- **Shield** — hold a zone at 100% meter for 30 more continuous ticks (alone,
  as the owning team) to bank a charge. Activate it from a zone you own at
  100% to lock it against decay and contest for 5 minutes (8 for Defenders).
- **Surge** — chain 3 captures within 2 minutes (2 for Sprinters) to trigger
  a 45-second Surge: your capture presence extends to the 8 neighboring
  cells, so a fast lap claims the whole block. Shown as an orange ring
  around your token on the map.
- **Radar Ping** — every ~12 grid-units of simulated movement (6 for Scouts)
  banks a charge. Activate it to reveal enemy positions within a 5-cell
  radius for 20 seconds (dashed rings on the map).
- **Second Wind** — start a Fitness Mode workout (shortened to 60 seconds
  here for demo purposes — see `FITNESS_WORKOUT_MIN_MS`) and claim it on
  completion. Activate it on a zone you own to cancel its next decay tick.

## Campus Siege — team campaign

The 12×12 grid is grouped into 16 sectors (`backend/campaign.js`), each
labeled A1–D4. A sector is "secured" by whichever team holds ≥55% of its
combined zone meter. The whole board resets on a recurring siege timer
(`SIEGE_DURATION_MINUTES` env var — defaults to 5 days; set it low, e.g. `10`,
to actually watch a reset happen in dev).

Three squad roles, picked on the Deploy screen (`POST /campaign/role`):
- **Scout** — Radar charges twice as fast.
- **Defender** — Shields last 8 minutes instead of 5.
- **Sprinter** — +20% capture rate, Surge triggers after 2 captures instead
  of 3.

Open **Command Center → Siege** in-app to see the sector grid and countdown.

## Passive & async mechanics (for players not currently out running)

All exposed as REST endpoints under `/campaign`, protected by the same JWT
as everything else (`Authorization: Bearer <token>`), and reachable in-app
via the **Command Center** panel:

- **Garrison** (`POST /campaign/garrison`) — spend banked "reserve steps"
  (accrued automatically: half of each session's earned XP converts into
  reserve steps on disconnect) to remotely reinforce a zone your squad
  already holds. Rate-capped per request.
- **Supply Lines** (`POST /campaign/supply`) — send XP to a teammate by
  callsign, whether they're online or not.
- **Scouting Reports** (`GET /campaign/scouting`) — a live digest: which
  sectors your team has secured, which enemy-held sectors are a threat, and
  a recommended next objective.
- **Standing Orders** (`GET`/`POST /campaign/orders`) — set a `defend` or
  `advance` priority on a sector for when you're not actively playing.

## Local development

**Backend**
```bash
cd backend
cp .env.example .env   # then fill in MONGODB_URI and JWT_SECRET
npm install
npm start        # runs on :4000
```

**Frontend** (in a second terminal)
```bash
cd frontend
cp .env.example .env   # VITE_BACKEND_URL=http://localhost:4000
npm install
npm run dev             # runs on :5173
```

Open two browser tabs on `http://localhost:5173` to see multiplayer capture
in action.

## Deploying

### Backend → Render
1. Push this repo to GitHub.
2. In Render: **New → Web Service**, point it at the repo, root directory
   `backend`. Render will pick up `render.yaml`, or set manually:
   - Build command: `npm install`
   - Start command: `npm start`
3. Set environment variables on the Render service:
   - `MONGODB_URI` — your Atlas (or other) connection string.
   - `JWT_SECRET` — a long random string (used to sign login tokens).
   - `FRONTEND_ORIGIN` — your Vercel URL once you have it (e.g.
     `https://stridewars.vercel.app`) — this is what the backend's CORS
     check allows.
   - `SIEGE_DURATION_MINUTES` (optional) — length of a Campus Siege cycle
     before the board resets. Defaults to 7200 (5 days).
4. Note the resulting backend URL, e.g. `https://stridewars-backend.onrender.com`.

### Frontend → Vercel
1. In Vercel: **New Project**, point it at the repo, root directory
   `frontend`. Framework preset: Vite.
2. Set the environment variable `VITE_BACKEND_URL` to your Render backend
   URL from above.
3. Deploy. Vercel will run `npm run build` and serve `dist/`.

### Wire them together
Once both are live, go back to Render and confirm `FRONTEND_ORIGIN` matches
your real Vercel domain (not `*`), then redeploy the backend so CORS allows
it.

## Known limits of this prototype

- Live grid/zone state (not accounts) is in-memory only — a backend restart
  clears the current map, though every player's XP and team survive in
  Mongo since they're written back on disconnect.
- XP is only persisted when a player disconnects cleanly. A server crash
  mid-session loses that session's unsaved XP — fine for a prototype, worth
  fixing (e.g. periodic autosave) before this is more than a demo.
- Free-tier Render web services spin down when idle, so the first request
  after inactivity will be slow to wake up.
- Passwords are hashed with bcrypt and never stored in plaintext, but
  there's no rate-limiting on `/auth/login` yet — add some before any real
  deployment.
- Power-up charges (Shield/Radar/Second Wind) and Surge state live only in
  the in-memory player object, same as position — they reset on reconnect,
  not just on a full server restart. Reserve steps, role, and standing
  orders persist in Mongo since they're written straight to the user's
  document.
- Fitness Mode's workout length is a client-reported timer with only a
  minimum-duration check on the server — fine for a demo, not tamper-proof.
- Campus Siege's sector math and countdown are computed fresh from live zone
  state on every read; there's no historical log of past siege winners yet.
