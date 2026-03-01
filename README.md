# Funny Survivors (MVP)

Local multiplayer party game.

## Dev

In one terminal:

```bash
npm run dev
```

- Server: http://localhost:3000/health
- Client: http://localhost:5173

To play on phones/tablets on the same Wi‑Fi:
- Find your Mac mini LAN IP (e.g. `192.168.1.50`)
- Open `http://192.168.1.50:5173` on each device

If you need to point the client at a non-localhost server, set:

```bash
VITE_SERVER_URL=http://192.168.1.50:3000
```
