# ➕ Adding Number Game

Two players take turns adding a number to a running total. Each turn you may add any
integer from **1** up to **Max add**. The first player whose total **reaches or exceeds
the Target** wins.

**Allowed settings:** Target **24–150**, Max add **2–15**, and
**Target ÷ (Max add + 1) between 8 and 15** (this keeps a game to a sensible length).
For example, with Max add = 2 the ratio rule puts the target between 24 and 45.

Three ways to play:

- **Two players** – hotseat on one PC.
- **vs Computer** – against an optimal AI, using cut-and-choose (below).
- **Online** – two humans on **different PCs**, over your network or the internet.

## Fair setup: cut-and-choose
This is a *solved* game: with perfect play the winner is decided by one fact — **the
player to move loses whenever `Target` is a multiple of `(Max add + 1)`**. So whoever
picks both numbers could always rig a win. To prevent that, the two roles are split:

> **One side sets the numbers; the *other* side then chooses to move first or second.**

Rigging the numbers no longer helps — the chooser simply takes the winning seat.
- **Online:** the host sets Target & Max add; the joiner picks first/second.
- **vs Computer:** pick who sets the numbers. If you set them, the computer takes the
  winning seat (so don't expect to rig it). If the computer sets them, **you** choose the
  seat — take the winning one and you can beat the optimal AI.

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
4. Host: pick **Online → Create room**, set Target & Max add, Start → a **room code**
   appears. Guest: pick **Online → Join room**, enter the code, Start.

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
It uses the winning strategy for this subtraction game: it tries to leave you on a
multiple of `Max add + 1`. If the game starts in a position where that's impossible, the
computer can be beaten with correct play.

## Project layout
```
game.js            shared game rules + AI (runs in browser and Node)
server.js          static file server + authoritative WebSocket rooms
public/index.html  the game UI (all three modes)
package.json       start script + ws dependency
```
