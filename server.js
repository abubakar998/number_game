// Plusminus — HTTP static server + authoritative WebSocket game rooms.
// Run: npm install && npm start   (listens on PORT or 3000)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const Game = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png', // og.png — social scrapers reject a wrong content type
  '.svg': 'image/svg+xml',
};

// ---- Usage counters ----
// Counts only: no cookies, no identifiers, no IP storage, so no consent banner needed.
// Kept in memory and echoed to stdout, since the free tier's disk is ephemeral — the log
// is what survives the restarts that wipe this object.
const MODES = ['hotseat', 'cpu', 'online'];
const ENDINGS = ['win', 'resign', 'timeout'];

const stats = {
  since: new Date().toISOString(),
  pageLoads: 0, // page loads, NOT unique visitors — there's nothing here to dedupe by
  started: { hotseat: 0, cpu: 0, online: 0 },
  finished: { hotseat: 0, cpu: 0, online: 0 },
  byVariant: { add: 0, sub: 0 },
  byEnding: { win: 0, resign: 0, timeout: 0 },
};

// The event sink is public, so it trusts nothing: allowlisted values only.
function recordEvent(body) {
  const mode = MODES.indexOf(body.mode) !== -1 ? body.mode : null;
  if (!mode) return;
  if (body.event === 'game_start') {
    stats.started[mode]++;
    if (Game.variantValid(body.variant)) stats.byVariant[body.variant]++;
    return;
  }
  if (body.event === 'game_end') {
    stats.finished[mode]++;
    if (ENDINGS.indexOf(body.ending) !== -1) stats.byEnding[body.ending]++;
    const s = Object.values(stats.started).reduce((a, b) => a + b, 0);
    const f = Object.values(stats.finished).reduce((a, b) => a + b, 0);
    console.log(`[stats] finished ${mode}/${body.variant}/${body.ending} — started=${s} finished=${f}`);
  }
}

const MAX_EVENT_BYTES = 1024;

function handleEvent(req, res) {
  let body = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    if (tooBig) return;
    body += chunk;
    if (body.length > MAX_EVENT_BYTES) { tooBig = true; body = ''; } // never buffer unboundedly
  });
  req.on('end', () => {
    if (!tooBig) {
      try { recordEvent(JSON.parse(body)); } catch (e) { /* malformed: drop silently */ }
    }
    res.writeHead(204).end();
  });
}

// ---- Static file server ----
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Routed before the static lookup below, which would otherwise treat these as filenames.
  if (urlPath === '/e' && req.method === 'POST') { handleEvent(req, res); return; }
  if (urlPath === '/stats') {
    const token = process.env.STATS_TOKEN;
    if (token && new URL(req.url, 'http://x').searchParams.get('token') !== token) {
      res.writeHead(401).end('Unauthorized');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(stats, null, 2));
    return;
  }

  if (urlPath === '/') { urlPath = '/index.html'; stats.pageLoads++; }

  // game.js lives at project root but is shared with the client.
  let filePath;
  if (urlPath === '/game.js') {
    filePath = path.join(__dirname, 'game.js');
  } else {
    // Prevent path traversal by resolving inside PUBLIC_DIR.
    filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---- WebSocket game rooms ----
const wss = new WebSocketServer({ server });
// code -> { code, players:[ws,ws], tokens:[t,t], state, target, maxAdd, scores:{1,2}, graceTimer }
const rooms = new Map();
const RECONNECT_GRACE_MS = 60000; // keep a room alive this long after a disconnect

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makeToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcastState(room, move) {
  const payload = {
    type: 'state', state: room.state, scores: room.scores,
    turnSeconds: room.turnSeconds, turnMsLeft: turnMsLeft(room),
  };
  if (move) payload.move = move;
  room.players.forEach((ws) => send(ws, payload));
}

// ---- Turn clock (server-authoritative) ----
// The clock is restarted only where a new turn actually begins, never on reconnect —
// otherwise a player could refresh the page to buy themselves a fresh turn.
function clearTurnTimer(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
  room.turnDeadline = null;
}

function startTurnTimer(room) {
  clearTurnTimer(room);
  if (!room.turnSeconds) return;                    // timer switched off for this room
  if (!room.state || room.state.winner !== null) return;
  const ms = room.turnSeconds * 1000;
  room.turnDeadline = Date.now() + ms;
  room.turnTimer = setTimeout(() => onTurnTimeout(room), ms);
}

function turnMsLeft(room) {
  if (!room.turnDeadline || !room.state || room.state.winner !== null) return null;
  return Math.max(0, room.turnDeadline - Date.now());
}

// Turn ran out: add a random legal amount for whoever was to move. This also covers a
// player who walked away or dropped mid-turn — the game shouldn't stall waiting on them.
function onTurnTimeout(room) {
  room.turnTimer = null;
  if (!room.state || room.state.winner !== null) return;
  const mover = room.state.currentPlayer;
  const n = Game.randomMove(room.state);
  Game.applyMove(room.state, n);
  if (room.state.winner !== null) room.scores[room.state.winner]++;
  startTurnTimer(room);
  broadcastState(room, { player: mover, n, timedOut: true });
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.playerNum = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'create') {
      const target = parseInt(msg.target, 10);
      const maxAdd = parseInt(msg.maxAdd, 10);
      if (!Game.paramsValid(target, maxAdd)) { send(ws, { type: 'error', message: 'Invalid parameters.' }); return; }
      const code = makeCode();
      const token = makeToken();
      // The host picks the turn clock for the room; the joiner inherits it.
      const turnSeconds = Game.turnSecondsValid(parseInt(msg.turnSeconds, 10))
        ? parseInt(msg.turnSeconds, 10)
        : Game.TURN_SECONDS_DEFAULT;
      const variant = Game.variantValid(msg.variant) ? msg.variant : 'add';
      const room = {
        code, players: [ws, null], tokens: [token, null],
        // Cut-and-choose: the host (player 1) sets the numbers; the joiner (player 2)
        // then chooses who moves first. `state` stays null until that choice.
        target, maxAdd, variant, firstMover: null, state: null,
        scores: { 1: 0, 2: 0 }, graceTimer: null,
        turnSeconds, turnTimer: null, turnDeadline: null,
      };
      rooms.set(code, room);
      ws.roomCode = code;
      ws.playerNum = 1;
      ws.token = token;
      send(ws, { type: 'created', code, player: 1, token });
      return;
    }

    if (msg.type === 'join') {
      const room = rooms.get((msg.code || '').toUpperCase());
      if (!room) { send(ws, { type: 'error', message: 'Room not found.' }); return; }
      if (room.players[1]) { send(ws, { type: 'error', message: 'Room is full.' }); return; }
      const token = makeToken();
      room.players[1] = ws;
      room.tokens[1] = token;
      ws.roomCode = room.code;
      ws.playerNum = 2;
      ws.token = token;
      send(ws, { type: 'joined', player: 2, token });
      if (room.state) {
        // Game already under way — the original player 2 dropped and someone opened the
        // invite link again. Drop them onto the live board rather than a seat picker,
        // which `seat` would ignore anyway now that the game has started.
        send(room.players[0], { type: 'opponent_reconnected' });
        broadcastState(room); // resync only: does not restart the turn clock
        return;
      }
      // Joiner picks first/second before the game starts.
      send(ws, { type: 'choose_seat', target: room.target, maxAdd: room.maxAdd, turnSeconds: room.turnSeconds, variant: room.variant });
      send(room.players[0], { type: 'opponent_choosing' });
      return;
    }

    if (msg.type === 'seat') {
      const room = rooms.get(ws.roomCode);
      if (!room || ws.playerNum !== 2) return; // only the joiner chooses
      if (room.state) return; // already chosen/started
      // Joiner (player 2) picks whether they move first.
      room.firstMover = msg.mefirst ? 2 : 1;
      room.state = Game.createState(room.target, room.maxAdd, room.firstMover, room.variant);
      startTurnTimer(room);
      broadcastState(room);
      return;
    }

    if (msg.type === 'reconnect') {
      const room = rooms.get((msg.code || '').toUpperCase());
      if (!room) { send(ws, { type: 'error', message: 'Room no longer exists.' }); return; }
      const idx = room.tokens.indexOf(msg.token);
      if (idx === -1) { send(ws, { type: 'error', message: 'Could not rejoin this room.' }); return; }
      if (room.graceTimer) { clearTimeout(room.graceTimer); room.graceTimer = null; }
      room.players[idx] = ws;
      ws.roomCode = room.code;
      ws.playerNum = idx + 1;
      ws.token = msg.token;
      send(ws, { type: 'rejoined', player: idx + 1 });
      const other = room.players[idx === 0 ? 1 : 0];
      send(other, { type: 'opponent_reconnected' });
      if (room.state) {
        broadcastState(room); // game in progress: resync the returning player's board
      } else if (ws.playerNum === 2) {
        send(ws, { type: 'choose_seat', target: room.target, maxAdd: room.maxAdd, turnSeconds: room.turnSeconds, variant: room.variant }); // hadn't chosen yet
      } else {
        send(ws, { type: 'opponent_choosing' }); // host waiting on joiner's choice
      }
      return;
    }

    if (msg.type === 'move') {
      const room = rooms.get(ws.roomCode);
      if (!room || !room.state) return; // game not started yet
      if (room.state.winner !== null) return;
      if (room.state.currentPlayer !== ws.playerNum) { send(ws, { type: 'error', message: 'Not your turn.' }); return; }
      const n = parseInt(msg.n, 10);
      if (!Game.isValidMove(room.state, n)) { send(ws, { type: 'error', message: 'Illegal move.' }); return; }
      const mover = room.state.currentPlayer;
      Game.applyMove(room.state, n);
      if (room.state.winner !== null) room.scores[room.state.winner]++;
      startTurnTimer(room);
      broadcastState(room, { player: mover, n });
      return;
    }

    // Conceding is allowed at any time, not just on your turn — each socket is
    // unambiguously one player, so there's no doubt about who gave up.
    if (msg.type === 'resign') {
      const room = rooms.get(ws.roomCode);
      if (!room || !room.state) return;            // game hasn't started yet
      if (room.state.winner !== null) return;      // already decided
      if (ws.playerNum !== 1 && ws.playerNum !== 2) return;
      Game.resign(room.state, ws.playerNum);
      room.scores[room.state.winner]++;
      startTurnTimer(room); // clears the clock, since the game now has a winner
      broadcastState(room, { player: ws.playerNum, resigned: true });
      return;
    }

    if (msg.type === 'rematch') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.firstMover === null) return;
      room.state = Game.createState(room.target, room.maxAdd, room.firstMover, room.variant);
      startTurnTimer(room);
      broadcastState(room);
      return;
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const idx = room.players.indexOf(ws);
    if (idx === -1) return; // already replaced by a reconnect
    room.players[idx] = null;

    const other = room.players[idx === 0 ? 1 : 0];
    if (!other) { clearTurnTimer(room); rooms.delete(room.code); return; } // both gone

    // Keep the room alive briefly so the player can reconnect with their token.
    send(other, { type: 'opponent_disconnected' });
    room.graceTimer = setTimeout(() => {
      const cur = rooms.get(room.code);
      if (!cur) return;
      const remaining = cur.players[idx === 0 ? 1 : 0];
      send(remaining, { type: 'opponent_left' });
      clearTurnTimer(cur);
      rooms.delete(room.code);
    }, RECONNECT_GRACE_MS);
  });
});

// ---- Optional keep-alive ----
// Render's free tier sleeps after ~15 min idle, so the first visitor after a quiet spell
// waits ~30s. Setting KEEPALIVE_URL to the public URL makes the instance ping itself to
// stay awake. Off by default: it burns free-tier hours that the host would rather reclaim,
// so the clean fix for a busy site is a paid instance. Handy around a launch push.
function startKeepAlive() {
  const url = process.env.KEEPALIVE_URL;
  if (!url) return;
  const minutes = Number(process.env.KEEPALIVE_MINUTES) || 10;
  const client = url.startsWith('https:') ? require('https') : require('http');
  setInterval(() => {
    client.get(url, (res) => { res.resume(); }).on('error', (e) => {
      console.log('keep-alive ping failed:', e.message);
    });
  }, minutes * 60 * 1000).unref(); // never hold the process open on its own
  console.log(`Keep-alive: pinging ${url} every ${minutes} min`);
}

server.listen(PORT, () => {
  console.log(`Plusminus running at http://localhost:${PORT}`);
  console.log('For cross-PC play across the internet: npx ngrok http ' + PORT);
  startKeepAlive();
});
