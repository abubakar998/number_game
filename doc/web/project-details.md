# ± Plusminus — Project Details

A two-player number game in **two directions** — count up to a target, or count down to
zero. Playable hotseat, against a computer at three skill levels, or online across two PCs.

The name comes from the two variants being the same game read forwards and backwards; the
± glyph doubles as the logo and favicon.

Live at <https://number-game-2l4k.onrender.com/>.

---

## 1. Game rules

Two variants share one engine; pick either in setup.

| Variant | Total starts at | Each turn | Outcome |
|---------|-----------------|-----------|---------|
| **Addition** | `0` | add `n`, `1 ≤ n ≤ Max add` | first to reach **≥ Target** *wins* |
| **Subtraction** | `Target` | subtract `n`, `1 ≤ n ≤ Max subtract` | whoever lands exactly on **0** *loses* |

Subtraction is the *misère* form. You may never go below zero, so the legal range narrows
near the end — with 3 left you may only take 1, 2, or 3. That squeeze is what eventually
forces someone onto zero.

### Allowed settings
| Parameter | Range |
|-----------|-------|
| Target | 24 – 150 |
| Max add / Max subtract | 2 – 15 |
| Target ÷ (Max + 1) | 8 – 15 (keeps games a sensible length) |

The ratio rule interacts with the bounds — e.g. with Max = 2 the only valid targets are
24–45 (since `24/3 = 8` and `45/3 = 15`).

### The math (why fairness matters)
Both variants are solved games. Writing `k = Max + 1`, the player **to move** loses when:

| Variant | Losing position | So the first mover loses if |
|---------|-----------------|----------------------------|
| Addition | the amount remaining is a multiple of `k` | `Target % k == 0` |
| Subtraction | the total is `1` more than a multiple of `k` | `Target % k == 1` |

The subtraction case bottoms out at a total of exactly `1`: you must take it and hit zero.
Note the two rules differ (`0` vs `1`) — treating them as the same would silently invert
the AI's seat choice. Because the outcome is decided the moment the numbers are picked,
whoever chooses both could always rig a win, which the fairness mechanism below prevents.

### Turn timer
Every turn is limited — **Off / 30s / 1 min / 2 min**, chosen in setup. When a turn
expires a **random legal amount** is played for that player, so a game can never stall.
Online, the host's choice governs the room and the countdown is run by the **server**, not
the browser, so both players always see the same clock. A reconnect *resumes* the clock
rather than restarting it — otherwise reloading the page would buy a fresh turn.

### Surrender
Either player may concede the current game; the opponent takes the win and it counts as a
normal loss in the running score. It asks for confirmation first. Online you may concede at
any moment; in hotseat it applies to whoever's turn it is; in vs Computer it's available on
your turn. **The computer never resigns** — it always plays the game out.

---

## 2. Modes

| Mode | Description |
|------|-------------|
| **Two players** | Hotseat on one device; players alternate on the same screen. |
| **vs Computer** | Three difficulty levels (below). Uses cut-and-choose. |
| **Online** | Two humans on different PCs over WebSockets; LAN or internet. |

### Difficulty
Difficulty controls two things — how often the computer finds the optimal move, and how
often it claims the winning seat in cut-and-choose. The second matters as much as the
first: a computer that always takes the winning seat is unbeatable regardless of how badly
it plays afterwards.

| Level | Finds the best move | Takes the winning seat |
|-------|--------------------|------------------------|
| Beginner | 35% | 25% |
| Professional | 80% | 85% |
| Legendary | always | always |

Every level still takes a win it can see this turn — reaching the target in Addition, or
leaving you on `1` in Subtraction. Measured human win rates against Professional: 20% at
40% accuracy, 30% at 60%, 56% at 85%. Legendary is perfect play and cannot be beaten from
a won seat; your chance against it comes entirely from the seat choice.

### Fair setup: cut-and-choose
To stop the number-setter from forcing a win, the two roles are split:

> **One side sets the numbers; the *other* side then chooses to move first or second.**

Rigging the numbers no longer helps — the chooser simply takes the winning seat.

- **Online:** host sets Target & Max → joiner picks first/second.
- **vs Computer:**
  - *You set the numbers* → the computer picks its seat (reliably only at higher levels).
  - *Computer sets the numbers* → it picks valid random numbers and **you** choose the
    seat; take the winning one and you can beat even Legendary.

### Online extras
- **Score tracking** across rematches (per-room, server-authoritative).
- **Reconnect**: on a dropped socket the room is held for a 60-second grace period; the
  player rejoins with a secret token and the board, score, and turn clock resync.
- A player who disconnects on their own turn keeps burning their clock and gets
  auto-moved, rather than stalling the game until the grace period expires.

---

## 3. Architecture

```
game.js               Shared pure logic + rules + AI (runs in browser AND Node)
server.js             HTTP static server + authoritative WebSocket game rooms
public/index.html     Single-file client UI (all modes, inline CSS + JS)
public/og.png         Social share card (generated, committed)
tools/make-og-image.js Regenerates og.png using only Node's built-in zlib
package.json          start script + the single dependency (ws)
render.yaml           Render Blueprint for the free-tier deployment
```

### Invite links
Creating a room shows a **Copy invite link** button producing `…/?room=CODE`. Opening that
link switches to Online mode and joins automatically, so the recipient never types a code.
If the game is already under way (the other player closed the tab and reopened the link),
the server drops them onto the live board rather than a seat picker.

### Environment variables
`PORT` (default 3000). `KEEPALIVE_URL` — optional; when set, the instance pings that URL
every `KEEPALIVE_MINUTES` (default 10) to keep a sleeping free-tier host awake. Off unless
set.

The client runs local modes (hotseat, vs Computer) entirely in the browser. Online mode
talks to the server, which is the **single source of truth**: it validates every move,
rejects out-of-turn/illegal actions, owns the turn clock, tracks scores, and broadcasts a
full state snapshot after each change so the two clients never diverge.

### `game.js` — shared logic
Loads as `window.Game` in the browser and via `require` in Node. Variant-aware throughout —
`state.variant` (`'add'` / `'sub'`) drives the branching, so callers rarely special-case.

| Export | Purpose |
|--------|---------|
| `createState(target, maxAdd, firstPlayer, variant)` | Fresh state; starts the total at `0` or `target` per variant. |
| `maxLegal(state)` | Largest legal amount now — the subtraction clamp near zero. |
| `isValidMove(state, n)` | `1 ≤ n ≤ maxLegal(state)` and game not over. |
| `applyMove(state, n)` | Applies `n` and sets `winner`. In `sub`, hitting 0 makes the *opponent* the winner. |
| `resign(state, player)` | Concede: winner becomes the opponent; records `resignedBy`. No-op once decided. |
| `bestMove(state)` | Optimal move for the variant; from a lost position plays a random legal amount. |
| `cpuMove(state, level)` | The move actually played at a skill level (blunders included). |
| `chooseSeatFor(target, maxAdd, level, variant)` | Cut-and-choose seat pick; variant-correct. |
| `randomMove(state)` | Uniform legal amount — used for timed-out turns. |
| `paramsValid(target, maxAdd)` | Enforces the Target / Max / ratio ranges. |
| `variantValid(v)` / `turnSecondsValid(s)` | Input validation for the server. |
| `PARAM_LIMITS`, `VARIANTS`, `DIFFICULTY`, `TURN_SECONDS_CHOICES` | Constants and display metadata (single source of truth for client + server). |

Naming note: the per-turn limit is `maxAdd` in the state and on the wire even in the
subtraction variant, where it means "max subtract". Renaming it would touch the protocol,
so the UI relabels it instead.

### `server.js` — rooms & protocol
Rooms are keyed by a 6-char code. State is created only after the joiner picks a seat.

**Client → server:**
`create {target, maxAdd, variant, turnSeconds}`, `join {code}`, `seat {mefirst}`,
`move {n}`, `resign`, `rematch`, `reconnect {code, token}`.

**Server → client:**
`created {code, player, token}`, `joined {player, token}`,
`choose_seat {target, maxAdd, variant, turnSeconds}`, `opponent_choosing`,
`state {state, scores, turnSeconds, turnMsLeft, move?}`, `rejoined {player}`,
`opponent_disconnected`, `opponent_reconnected`, `opponent_left`, `error {message}`.

The `move` field on a `state` broadcast carries `{player, n}` plus `timedOut: true` for a
clock expiry or `resigned: true` for a concession, so clients can log it accurately.

---

## 4. Running

Requires Node.js 18+.

```bash
npm install
npm start          # serves on http://localhost:3000
```

- **Local modes:** open the URL and play — no network needed.
- **Online, same LAN:** the other player opens `http://<host-ip>:3000`; use Create/Join.
- **Online, internet:** `npx ngrok http 3000` and share the `https` URL + room code, or use
  the live deployment.

### Deployment
Deployed to Render from `main` via the `render.yaml` Blueprint. On the free tier the
instance sleeps after ~15 min idle (next visit takes ~30s to wake), and rooms are in-memory
— a sleep or redeploy ends any game in progress. Keep it to a single instance; rooms are
not shared between replicas.

---

## 5. Verification notes

The logic is covered by scripted checks (run against `game.js` and a live server):

- **Rules & AI, both variants:** an exhaustive minimax solve over the full game tree
  confirms the losing-position sets are exactly as documented above, and that `bestMove`
  wins from *every* won position.
- **Move legality:** `randomMove` and `cpuMove` (all levels) only ever return legal moves,
  sampled across every total — especially the subtraction clamp zone where fewer numbers
  remain than Max subtract. The server rejects oversized subtractions.
- **Subtraction end conditions:** games always land exactly on 0, never go negative, and
  the player who hits zero always loses.
- **Fairness:** Legendary claims the winning seat 100% of the time in both variants, and
  perfect-play simulations confirm the winning seat always wins.
- **Turn timer:** a timeout auto-moves exactly once with both clients agreeing; "Off" never
  fires; the clock stops at game end; and a mid-turn reconnect *resumes* rather than
  resets it (the refresh-for-a-fresh-minute exploit).
- **Surrender:** the win goes to the opponent in both variants, a second resign can't flip
  the result, resigning before the game starts or after it ends is ignored, and a rematch
  after a resign starts clean.
- **Online flow:** create → choose seat → move → win, score tracking, rematch keeps
  seating, and reconnect (including reconnect before the seat is chosen).
- **Parameters:** `paramsValid` matches the spec across the full grid; computer-picked
  numbers are always valid with the ratio in [8, 15].
