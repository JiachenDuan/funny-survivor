import { useMemo, useState } from 'react';
import './App.css';
import { useSocket } from './useSocket';

export default function App() {
  const { socket, state, meId, joinError, setJoinError } = useSocket();

  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [prompt, setPrompt] = useState('');

  const isHost = meId && state?.hostId === meId;

  const submissionIds = useMemo(() => {
    return new Set((state?.submissions || []).map((s) => s.id));
  }, [state]);

  if (!state) return <div style={{ padding: 16 }}>Connecting…</div>;

  const players = state.players || [];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h2>Funny Survivor (MVP)</h2>

      <div style={{ marginBottom: 12, opacity: 0.8 }}>
        <b>Room code:</b> {state.roomCode}
        {isHost ? ' (you are host)' : ''}
      </div>

      {!joined ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Room code (optional)"
            style={{ padding: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{ flex: 1, padding: 10 }}
            />
            <button
              onClick={() => {
                setJoinError(null);
                socket.emit('join', { name, roomCode });
                setJoined(true);
              }}
            >
              Join
            </button>
          </div>
          {joinError ? <div style={{ color: 'crimson' }}>{joinError}</div> : null}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <div>
          <b>Phase:</b> {state.phase}
        </div>

        <div style={{ marginTop: 8 }}>
          <b>Players</b>
          <ul>
            {players.map((p) => (
              <li key={p.id}>
                {p.name} — {p.score}
                {p.id === state.hostId ? ' (host)' : ''}
              </li>
            ))}
          </ul>
        </div>

        {isHost && (state.phase === 'lobby' || state.phase === 'results') && (
          <button onClick={() => socket.emit('startRound')}>Start round</button>
        )}

        {state.phase === 'prompting' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ opacity: 0.8, marginBottom: 8 }}>
              Write a prompt that matches the secret target.
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: 10 }}
              placeholder="e.g., A crab wearing a detective hat"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ opacity: 0.7 }}>
                {meId && submissionIds.has(meId) ? 'Submitted ✓' : ''}
              </div>
              <button onClick={() => socket.emit('submitPrompt', { text: prompt })}>Submit</button>
            </div>
          </div>
        )}

        {state.phase === 'gallery' && (
          <div style={{ marginTop: 12 }}>
            <b>Gallery</b>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {(state.submissions || []).map((s) => (
                <div key={s.id} style={{ padding: 12, border: '1px solid #ddd' }}>
                  {s.text}
                </div>
              ))}
            </div>
            {isHost ? (
              <div style={{ marginTop: 12 }}>
                <button onClick={() => socket.emit('startVoting')}>Start voting</button>
              </div>
            ) : (
              <div style={{ marginTop: 12, opacity: 0.75 }}>Waiting for host to start voting…</div>
            )}
          </div>
        )}

        {state.phase === 'voting' && (
          <div style={{ marginTop: 12 }}>
            <b>Vote: closest to the secret target</b>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {(state.submissions || []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => socket.emit('vote', { votedId: s.id })}
                  disabled={!meId || s.id === meId}
                  style={{ textAlign: 'left', padding: 12 }}
                >
                  {s.text}
                  {meId && s.id === meId ? ' (you)' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'results' && (
          <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5' }}>
            <div>
              <b>Target prompt:</b> {state.targetPrompt}
            </div>
            <div style={{ marginTop: 8, opacity: 0.8 }}>
              Host can start the next round.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
