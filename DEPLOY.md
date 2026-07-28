# Deploying Plusminus (free)

The online mode needs a persistent Node process with WebSocket support, so it can't go on a
static/serverless host (GitHub Pages, Netlify, Vercel static). The easiest **free** option
is **Render**. Fly.io is a good free alternative (below).

The app is already host-ready: it listens on `process.env.PORT`, serves the WebSocket on
that same port (upgraded to `wss://` automatically behind HTTPS), and starts with
`npm start`.

---

## Option A — Render (recommended, free)

### 1. Push the repo to GitHub
Render deploys from a Git repo. Create an empty repo on GitHub, then from this folder:

```bash
git add -A
git commit -m "Prepare for deploy"          # if you have uncommitted changes
git remote add origin https://github.com/<you>/adding-number-game.git
git push -u origin main
```

### 2. Create the service on Render
Sign up at <https://render.com> (free), then either:

- **Blueprint (uses `render.yaml`):** New → **Blueprint** → connect your repo → Apply.
  Render reads `render.yaml` and provisions a free web service. **Or**
- **Manual:** New → **Web Service** → connect your repo, then set:
  - Runtime: **Node**
  - Build command: `npm install`
  - Start command: `npm start`
  - Instance type / plan: **Free**

Click Create. After the build, Render gives you a URL like
`https://adding-number-game.onrender.com`.

### 3. Play
Open the URL. Local modes (Two players, vs Computer) work immediately. For online, both
players open the URL and use **Create room** / **Join room** — the WebSocket connects over
`wss://` automatically, no extra config.

### Free-tier notes
- **Cold start:** the free instance sleeps after ~15 min idle; the next visit takes ~30s to
  wake.
- **In-memory rooms:** a sleep or restart clears active rooms, so an in-progress online game
  would end. Just create a new room.
- **Single instance only:** don't scale to multiple instances — rooms aren't shared between
  replicas.

---

## Option B — Fly.io (free allowance, no idle sleep)

1. Install [flyctl](https://fly.io/docs/flyctl/install/) and run `fly auth signup`.
2. From this folder run `fly launch` — it detects Node, auto-generates a `Dockerfile` and
   `fly.toml`, and asks a few questions (choose the free/smallest size, deploy now).
3. `fly deploy` on subsequent updates. Fly gives a `https://<app>.fly.dev` URL; WebSocket
   works over `wss://` the same way.

The same in-memory/single-instance notes apply — keep it to one machine.

---

## Not suitable
GitHub Pages, Netlify, and Vercel (static or serverless) — no persistent WebSocket, and the
in-memory rooms wouldn't survive between requests.
