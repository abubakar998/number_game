# ± Plusminus

*One game, two directions.*

Two players take turns changing a running total. Pick one of two games in setup:

- **Addition** — the total starts at **0**. Each turn add any integer from **1** up to
  **Max add**. The first player whose total **reaches or exceeds the Target** wins.
- **Subtraction** — the total starts at **the Target** and counts down. Each turn
  subtract from **1** up to **Max subtract**. Whoever **lands exactly on zero loses**.
  You can never go below zero, so with 3 left you may only subtract 1, 2, or 3 — the
  choices narrow until someone is squeezed onto zero.

Everything else — the modes, difficulty levels, turn timer, and online rooms — works the
same in both games.

**Surrender:** since both games are solved, you often know you're beaten well before the
total runs out. The **Surrender** button concedes the current game — your opponent takes
the win, and it counts as a normal loss in the running score. It asks for confirmation
first. Online you may concede at any moment; in **Two players** it applies to whoever's
turn it is, and in **vs Computer** it's available on your turn (the computer never
resigns — it always plays the game out).

**Allowed settings:** Target **24–150**, Max add **2–15**, and
**Target ÷ (Max add + 1) between 8 and 15** (this keeps a game to a sensible length).
For example, with Max add = 2 the ratio rule puts the target between 24 and 45.

**Turn timer:** each turn is limited to **1 minute** by default — pick **Off**, **30
seconds**, **1 minute**, or **2 minutes** in setup. When a turn runs out, a random legal
amount is added for that player and play moves on, so a game can never stall. In Online
mode the **host's** choice applies to the whole room, and the countdown is run by the
server (not the browser), so both players always see the same clock.

Three ways to play:

- **Two players** – hotseat on one PC.
- **vs Computer** – pick a difficulty (**Beginner / Amateur**, **Pro**, **Legendary**),
  using cut-and-choose (below).
- **Online** – two humans on **different PCs**, over your network or the internet.

## Fair setup: cut-and-choose
Both games are *solved*: with perfect play the winner is decided the moment the numbers
are chosen. Writing `k = Max add + 1` (or `Max subtract + 1`), the player to move loses when

| Game | The player to move loses when |
| --- | --- |
| Addition | the amount remaining is a multiple of `k` — so the **first mover loses if `Target % k == 0`** |
| Subtraction | the total is `1` more than a multiple of `k` — so the **first mover loses if `Target % k == 1`** |

(In subtraction, a total of exactly `1` is hopeless: you must take it and hit zero.)

So whoever picks both numbers could always rig a win. To prevent that, the two roles are split:

> **One side sets the numbers; the *other* side then chooses to move first or second.**

Rigging the numbers no longer helps — the chooser simply takes the winning seat.
- **Online:** the host sets Target & Max add; the joiner picks first/second.
- **vs Computer:** pick who sets the numbers. If you set them, the computer chooses its
  seat — at **Legendary** it always takes the winning one (so don't expect to rig it),
  while easier levels often pick wrong. If the computer sets them, **you** choose the
  seat — take the winning one and you can beat even Legendary.

## Requirements
- [Node.js](https://nodejs.org/) 18 or newer.

## Install & run
```bash
npm install
npm start
```
Then open **http://localhost:3000** in your browser.

The local modes (Two players / vs Computer) work entirely in the browser — no network
needed. Online mode uses the server.

## Play online on the same network (LAN)
1. On the host PC, run `npm start`.
2. Find the host's local IP (Windows: `ipconfig` → IPv4 Address, e.g. `192.168.1.20`).
3. The other player opens `http://192.168.1.20:3000` on their PC.
4. Host: pick **Online**, set Target & Max add, then click **Create room** → a **room
   code** appears. Guest: pick **Online**, enter the code, then click **Join room**.

> In online games the **host sets Target and Max add**, then the **joining player chooses
> to move first or second** (cut-and-choose), so the host can't rig the numbers to force
> a win.

> If the guest can't connect, allow Node.js through the host's firewall for private
> networks.

## Play online across the internet
Expose the local server with a tunnel:
```bash
npx ngrok http 3000
```
Share the printed `https://…ngrok…` URL **and** the room code with your opponent. Both of
you open that URL and use Create/Join as above. (`wss://` is handled automatically over
https.)

## Deploy (free)
For a permanent public link, deploy to a Node host with WebSocket support. The easiest free
option is **Render** (a `render.yaml` Blueprint is included); **Fly.io** works too. See
[DEPLOY.md](DEPLOY.md) for step-by-step instructions.

## How the computer plays
The winning strategy is to hand you a losing position from the table above — in Addition,
leave the remaining amount a multiple of `k`; in Subtraction, leave the total at `1` more
than a multiple of `k`. Difficulty controls how reliably the computer finds that move, and
how often it claims the winning seat in cut-and-choose:

| Level | Finds the best move | Takes the winning seat |
| --- | --- | --- |
| Beginner / Amateur | 35% | 25% |
| Pro | 80% | 85% |
| Legendary | always | always |

Every level still takes an immediate win when it sees one — reaching the target in
Addition, or leaving you on `1` in Subtraction. At
Legendary the play is perfect, so from a won seat it cannot be beaten — your chance comes
from the seat choice.

## Project layout
```
game.js            shared game rules + AI (runs in browser and Node)
server.js          static file server + authoritative WebSocket rooms
public/index.html  the game UI (all three modes)
package.json       start script + ws dependency
```
