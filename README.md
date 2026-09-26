# StrideWars

A working prototype of the StrideWars pitch: real-time multiplayer territory
capture driven by **simulated GPS** movement. Full front end + back end,
built to deploy as **frontend → Vercel** and **backend → Render**.

- `backend/` — Node.js + Express + Socket.io. Holds all game state in memory:
  a 12×12 zone grid, players, teams, capture/decay logic, XP, leaderboard,
  and a speed-based anti-cheat check on every position update.
- `frontend/` — React + Vite. Renders the grid, animates your player "walking"
  toward wherever you click (this is the simulated GPS — no real location
  permission is used), and shows live zone ownership + leaderboard over a
  WebSocket connection.

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

## Local development

**Backend**
```bash
cd backend
cp .env.example .env
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
3. Set the environment variable `FRONTEND_ORIGIN` to your Vercel URL
   (e.g. `https://stridewars.vercel.app`) once you have it — this is what
   the backend's CORS check allows.
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

- Game state is in-memory only — a backend restart clears the map. Swap in
  Redis or Postgres on Render if you want persistence across deploys.
- Free-tier Render web services spin down when idle, so the first request
  after inactivity will be slow to wake up.
- No auth — "join" just takes a callsign. Add real accounts if this becomes
  more than a demo.
