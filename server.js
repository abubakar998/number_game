// Adding Number Game — HTTP static server + authoritative WebSocket game rooms.
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
};

// ---- Static file server ----
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

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
  const payload = { type: 'state', state: room.state, scores: room.scores };
  if (move) payload.move = move;
  room.players.forEach((ws) => send(ws, payload));
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
      const room = {
        code, players: [ws, null], tokens: [token, null],
        // Cut-and-choose: the host (player 1) sets the numbers; the joiner (player 2)
        // then chooses who moves first. `state` stays null until that choice.
        target, maxAdd, firstMover: null, state: null,
        scores: { 1: 0, 2: 0 }, graceTimer: null,
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
      // Joiner picks first/second before the game starts.
      send(ws, { type: 'choose_seat', target: room.target, maxAdd: room.maxAdd });
      send(room.players[0], { type: 'opponent_choosing' });
      return;
    }

    if (msg.type === 'seat') {
      const room = rooms.get(ws.roomCode);
      if (!room || ws.playerNum !== 2) return; // only the joiner chooses
      if (room.state) return; // already chosen/started
      // Joiner (player 2) picks whether they move first.
      room.firstMover = msg.mefirst ? 2 : 1;
      room.state = Game.createState(room.target, room.maxAdd, room.firstMover);
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
        send(ws, { type: 'choose_seat', target: room.target, maxAdd: room.maxAdd }); // hadn't chosen yet
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
      broadcastState(room, { player: mover, n });
      return;
    }

    if (msg.type === 'rematch') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.firstMover === null) return;
      room.state = Game.createState(room.target, room.maxAdd, room.firstMover);
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
    if (!other) { rooms.delete(room.code); return; } // both gone

    // Keep the room alive briefly so the player can reconnect with their token.
    send(other, { type: 'opponent_disconnected' });
    room.graceTimer = setTimeout(() => {
      const cur = rooms.get(room.code);
      if (!cur) return;
      const remaining = cur.players[idx === 0 ? 1 : 0];
      send(remaining, { type: 'opponent_left' });
      rooms.delete(room.code);
    }, RECONNECT_GRACE_MS);
  });
});

server.listen(PORT, () => {
  console.log(`Adding Number Game running at http://localhost:${PORT}`);
  console.log('For cross-PC play across the internet: npx ngrok http ' + PORT);
});
