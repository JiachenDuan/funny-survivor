import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || true; // allow all in dev

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
  phase: 'lobby',
  players: new Map(), // socketId -> { id, name, score }
  prompts: new Map(), // socketId -> { text }
  votes: new Map(), // voterSocketId -> votedSocketId
  targetPrompt: 'A crab wearing a detective hat',
};

function publicState() {
  return {
    phase: state.phase,
    targetPrompt: state.phase === 'results' ? state.targetPrompt : null,
    players: Array.from(state.players.values()).map(p => ({ id: p.id, name: p.name, score: p.score })),
    submissions: state.phase === 'gallery' || state.phase === 'voting' || state.phase === 'results'
      ? Array.from(state.prompts.entries()).map(([id, p]) => ({ id, text: p.text }))
      : [],
    votes: state.phase === 'results'
      ? Array.from(state.votes.entries()).map(([voterId, votedId]) => ({ voterId, votedId }))
      : [],
  };
}

function broadcast() {
  io.emit('state', publicState());
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
  // Winner gets 1 point per vote for now
  for (const [playerId, count] of counts.entries()) {
    const player = state.players.get(playerId);
    if (player) player.score += count;
  }
}

io.on('connection', (socket) => {
  socket.on('join', ({ name }) => {
    const safeName = (name || '').toString().trim().slice(0, 24) || 'Player';
    state.players.set(socket.id, { id: socket.id, name: safeName, score: 0 });
    broadcast();
  });

  socket.on('startRound', () => {
    if (state.phase === 'lobby' || state.phase === 'results') resetRound();
  });

  socket.on('submitPrompt', ({ text }) => {
    if (state.phase !== 'prompting') return;
    const t = (text || '').toString().trim().slice(0, 240);
    if (!t) return;
    state.prompts.set(socket.id, { text: t });

    // Auto-advance when everyone submitted
    if (state.prompts.size === state.players.size && state.players.size >= 2) {
      state.phase = 'voting';
    }
    broadcast();
  });

  socket.on('vote', ({ votedId }) => {
    if (state.phase !== 'voting') return;
    if (!state.players.has(votedId)) return;
    if (votedId === socket.id) return; // no self vote

    state.votes.set(socket.id, votedId);

    // Auto-finish when everyone voted
    const eligibleVoters = state.players.size;
    if (state.votes.size === eligibleVoters) {
      tallyVotesAndScore();
      state.phase = 'results';
    }
    broadcast();
  });

  socket.on('disconnect', () => {
    state.players.delete(socket.id);
    state.prompts.delete(socket.id);
    state.votes.delete(socket.id);
    broadcast();
  });

  // Initial state push
  socket.emit('state', publicState());
});

server.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
