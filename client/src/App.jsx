import { useMemo, useState } from 'react';
import './App.css';
import { useSocket } from './useSocket';

export default function App() {
  const { socket, state } = useSocket();
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [prompt, setPrompt] = useState('');

  const me = useMemo(() => {
    if (!state) return null;
    // socket.id is not immediately available on first render; infer by matching name after join
    return null;
  }, [state]);

  if (!state) return <div style={{ padding: 16 }}>Connecting…</div>;

  const players = state.players || [];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h2>Everything is Crab (MVP)</h2>

      {!joined ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{ flex: 1, padding: 10 }}
          />
          <button
            onClick={() => {
              socket.emit('join', { name });
              setJoined(true);
            }}
          >
            Join
          </button>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <div><b>Phase:</b> {state.phase}</div>
        <div style={{ marginTop: 8 }}>
          <b>Players</b>
          <ul>
            {players.map((p) => (
              <li key={p.id}>{p.name} — {p.score}</li>
            ))}
          </ul>
        </div>

        {(state.phase === 'lobby' || state.phase === 'results') && (
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => socket.emit('submitPrompt', { text: prompt })}>Submit</button>
            </div>
          </div>
        )}

        {(state.phase === 'voting' || state.phase === 'results') && (
          <div style={{ marginTop: 12 }}>
            <b>Submissions</b>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {(state.submissions || []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => socket.emit('vote', { votedId: s.id })}
                  disabled={state.phase !== 'voting'}
                  style={{ textAlign: 'left', padding: 12 }}
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'results' && (
          <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5' }}>
            <b>Target prompt:</b> {state.targetPrompt}
          </div>
        )}
      </div>
    </div>
  );
}
