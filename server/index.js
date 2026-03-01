import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || true; // allow all in dev

function randomCode(len = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: CLIENT_ORIGIN }
});

// --- Minimal in-memory game state (Phase 1) ---
const state = {
  roomCode: process.env.ROOM_CODE || randomCode(4),
  hostId: null,
  phase: 'lobby', // lobby -> prompting -> gallery -> voting -> results
  players: new Map(), // socketId -> { id, name, score }
  prompts: new Map(), // socketId -> { text }
  votes: new Map(), // voterSocketId -> votedSocketId
  targetPrompt: 'A crab wearing a detective hat',
};

function publicState() {
  return {
    roomCode: state.roomCode,
    hostId: state.hostId,
    phase: state.phase,
    targetPrompt: state.phase === 'results' ? state.targetPrompt : null,
    players: Array.from(state.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
    })),
    submissions:
      state.phase === 'gallery' || state.phase === 'voting' || state.phase === 'results'
        ? Array.from(state.prompts.entries()).map(([id, p]) => ({ id, text: p.text }))
        : [],
  };
}

function broadcast() {
  io.emit('state', publicState());
}

function assertHost(socket) {
  return state.hostId && socket.id === state.hostId;
}

function resetRound() {
  state.phase = 'prompting';
  state.prompts.clear();
  state.votes.clear();
  broadcast();
}

function tallyVotesAndScore() {
  const counts = new Map(); // votedId -> count
  for (const votedId of state.votes.values()) {
    counts.set(votedId, (counts.get(votedId) || 0) + 1);
  }
  for (const [playerId, count] of counts.entries()) {
    const player = state.players.get(playerId);
    if (player) player.score += count;
  }
}

io.on('connection', (socket) => {
  socket.emit('me', { id: socket.id });

  socket.on('join', ({ name, roomCode }) => {
    const requestedCode = (roomCode || '').toString().trim().toUpperCase();
    if (requestedCode && requestedCode !== state.roomCode) {
      socket.emit('joinError', { message: 'Wrong room code.' });
      return;
    }

    const safeName = (name || '').toString().trim().slice(0, 24) || 'Player';
    state.players.set(socket.id, { id: socket.id, name: safeName, score: 0 });

    if (!state.hostId) state.hostId = socket.id;

    broadcast();
  });

  socket.on('startRound', () => {
    if (!assertHost(socket)) return;
    if (state.players.size < 2) return;
    if (state.phase === 'lobby' || state.phase === 'results') resetRound();
  });

  socket.on('startVoting', () => {
    if (!assertHost(socket)) return;
    if (state.phase !== 'gallery') return;
    state.phase = 'voting';
    broadcast();
  });

  socket.on('submitPrompt', ({ text }) => {
    if (state.phase !== 'prompting') return;
    const t = (text || '').toString().trim().slice(0, 240);
    if (!t) return;
    state.prompts.set(socket.id, { text: t });

    if (state.prompts.size === state.players.size && state.players.size >= 2) {
      state.phase = 'gallery';
    }
    broadcast();
  });

  socket.on('vote', ({ votedId }) => {
    if (state.phase !== 'voting') return;
    if (!state.players.has(votedId)) return;
    if (votedId === socket.id) return; // no self vote

    state.votes.set(socket.id, votedId);

    if (state.votes.size === state.players.size) {
      tallyVotesAndScore();
      state.phase = 'results';
    }
    broadcast();
  });

  socket.on('disconnect', () => {
    state.players.delete(socket.id);
    state.prompts.delete(socket.id);
    state.votes.delete(socket.id);

    if (state.hostId === socket.id) {
      // Promote first remaining player to host
      state.hostId = state.players.keys().next().value || null;
    }

    broadcast();
  });

  socket.emit('state', publicState());
});

server.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  console.log(`Room code: ${state.roomCode}`);
});
