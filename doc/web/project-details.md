# Adding Number Game — Project Details

A two-player "adding number" game. From a running total of 0, players alternate adding an
integer from **1 to Max add**; the first player whose total **reaches or exceeds the
Target** wins. Playable hotseat, against an optimal computer, or online across two PCs.

---

## 1. Game rules

- Total starts at **0**.
- On a turn, the active player adds an integer **n** where `1 ≤ n ≤ Max add`.
- The first player whose total is **≥ Target** wins (reaching *or* exceeding counts).

### Allowed settings
| Parameter | Range |
|-----------|-------|
| Target | 24 – 150 |
| Max add | 2 – 15 |
| Target ÷ (Max add + 1) | 8 – 15 (keeps games a sensible length) |

The ratio rule interacts with the bounds — e.g. with Max add = 2 the only valid targets
are 24–45 (since `24/3 = 8` and `45/3 = 15`).

### The math (why fairness matters)
This is a solved subtraction game. With perfect play, **the player to move loses whenever
`Target` is a multiple of `(Max add + 1)`**. So whoever chooses both numbers could always
rig a guaranteed win — which the fairness mechanism below prevents.

---

## 2. Modes

| Mode | Description |
|------|-------------|
| **Two players** | Hotseat on one device; players alternate on the same screen. |
| **vs Computer** | Play an optimal AI. Uses cut-and-choose (below). |
| **Online** | Two humans on different PCs over WebSockets; LAN or internet. |

### Fair setup: cut-and-choose
To stop the number-setter from forcing a win, the two roles are split:

> **One side sets the numbers; the *other* side then chooses to move first or second.**

Rigging the numbers no longer helps — the chooser simply takes the winning seat.

- **Online:** host sets Target & Max add → joiner picks first/second.
- **vs Computer:**
  - *You set the numbers* → the computer takes the winning seat (you can't rig it).
  - *Computer sets the numbers* → it picks valid random numbers and **you** choose the
    seat; take the winning one and you can beat the optimal AI.

### Online extras
- **Score tracking** across rematches (per-room, server-authoritative).
- **Reconnect**: on a dropped socket the room is held for a 60-second grace period; the
  player rejoins with a secret token and the board/score resync.

---

## 3. Architecture

```
game.js            Shared pure logic + rules + AI (runs in browser AND Node)
server.js          HTTP static server + authoritative WebSocket game rooms
public/index.html  Single-file client UI (all three modes, inline CSS + JS)
package.json       start script + the single dependency (ws)
```

The client runs local modes (hotseat, vs Computer) entirely in the browser. Online mode
talks to the server, which is the **single source of truth**: it validates every move,
rejects out-of-turn/illegal actions, tracks scores, and broadcasts a full state snapshot
after each change so the two clients never diverge.

### `game.js` — shared logic
Loads as `window.Game` in the browser and via `require` in Node.

| Function | Purpose |
|----------|---------|
| `createState(target, maxAdd, firstPlayer)` | Fresh state; `firstPlayer` (1/2) sets who moves first. |
| `isValidMove(state, n)` | `1 ≤ n ≤ maxAdd` and game not over. |
| `applyMove(state, n)` | Adds `n`, sets `winner` on reaching target, else swaps player. |
| `bestMove(state)` | Optimal move; from a losing position plays a random legal amount. |
| `paramsValid(target, maxAdd)` | Enforces the Target / Max add / ratio ranges. |
| `PARAM_LIMITS` | The range constants (single source of truth for client + server). |

### `server.js` — rooms & protocol
Rooms are keyed by a 6-char code. State is created only after the joiner picks a seat.

**Client → server:** `create {target, maxAdd}`, `join {code}`, `seat {mefirst}`,
`move {n}`, `rematch`, `reconnect {code, token}`.

**Server → client:** `created {code, player, token}`, `joined {player, token}`,
`choose_seat {target, maxAdd}`, `opponent_choosing`, `state {state, scores, move?}`,
`rejoined {player}`, `opponent_disconnected`, `opponent_reconnected`, `opponent_left`,
`error {message}`.

---

## 4. Running

Requires Node.js 18+.

```bash
npm install
npm start          # serves on http://localhost:3000
```

- **Local modes:** open the URL and play — no network needed.
- **Online, same LAN:** the other player opens `http://<host-ip>:3000`; use Create/Join.
- **Online, internet:** `npx ngrok http 3000` and share the `https` URL + room code, or
  deploy `server.js` to a Node host (Render / Railway / Fly).

---

## 5. Verification notes

The logic is covered by scripted checks (run against `game.js` and a live server):
- Rules & AI: win detection, move legality, and the AI winning from winning positions.
- Fairness: the chooser can always take the winning seat (online), and the computer as
  chooser wins every valid configuration.
- Online flow: create → choose seat → move → win, score tracking, rematch keeps seating,
  and reconnect (including reconnect before the seat is chosen).
- Parameters: `paramsValid` matches the spec across the full grid; computer-picked numbers
  are always valid with the ratio in [8, 15].
