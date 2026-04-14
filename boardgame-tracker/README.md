# Meeple — Board Game Tracker

A fully portable, frontend-only React application for tracking board games. No proprietary SDKs, no vendor lock-in.

## Stack

- **React 18** + **Vite** — fast dev server & build
- **Tailwind CSS** — utility-first styling
- **Radix UI** — accessible headless components (Dialog, Tooltip, Select)
- **Framer Motion** — smooth animations
- **lucide-react** — icons
- **react-router-dom** — client-side routing

## Quick Start

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` and proxies all `/api/...` requests to `http://localhost:3001`.

## Authentication

Uses a simple JWT flow:
- Register or login with **username + password** (no email)
- Token stored in `localStorage`
- Every request includes `Authorization: Bearer <token>`

**Test credentials:** `admin` / `admin`

## API Contract

All calls go through `src/api/` — one file per domain, all using the shared `src/api/client.js` base.

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/register` |
| Games | `GET /api/games/search?q=`, `GET /api/games/:id` |
| Library | `GET /api/library`, `POST /api/library`, `DELETE /api/library/:id` |
| Wishlist | `GET /api/wishlist`, `POST /api/wishlist`, `DELETE /api/wishlist/:id` |
| Plays | `GET /api/plays`, `POST /api/plays`, `DELETE /api/plays/:id` |
| Leagues | `GET /api/leagues`, `GET /api/leagues/:id/leaderboard`, `POST /api/leagues/:id/join`, `DELETE /api/leagues/:id/leave` |
| Dashboard | `GET /api/dashboard` |

### Expected Response Shapes

**`GET /api/dashboard`**
```json
{
  "library": { "totalGames": 12, "totalPlays": 34, "mostPlayedGame": { "name": "Catan", "plays": 8 } },
  "wishlist": { "totalGames": 5, "recentlyAdded": [{ "name": "Wingspan" }] },
  "plays": { "uniqueGames": 8, "totalSessions": 34, "winRate": 47, "mostPlayedGame": { "name": "Catan", "plays": 8 } },
  "league": { "score": 142, "wins": 12, "losses": 7, "winPercentage": 63, "leaderboardPosition": 3 }
}
```

**`GET /api/games/search?q=catan`**
```json
{ "games": [{ "id": "1", "name": "Catan", "image": "...", "yearPublished": 1995 }] }
```

**`GET /api/games/:id`**
```json
{
  "id": "1", "name": "Catan", "image": "...", "thumbnail": "...",
  "yearPublished": 1995, "bggRating": 7.2, "weight": 2.3,
  "minPlayers": 3, "maxPlayers": 4, "playingTime": 90,
  "designers": ["Klaus Teuber"], "artists": ["…"], "publishers": ["…"],
  "description": "…"
}
```

**`GET /api/plays`** (accepts `?dateFrom=&dateTo=&players=&gameId=` filters)
```json
{
  "plays": [{
    "id": "1", "gameId": "1", "gameName": "Catan", "gameImage": "…",
    "datePlayed": "2024-03-01",
    "players": [{ "name": "Alice", "score": 10, "winner": true }, { "name": "Bob", "score": 8, "winner": false }]
  }]
}
```

**`GET /api/leagues`**
```json
{ "leagues": [{ "id": "1", "name": "Friday Night League", "description": "…", "memberCount": 8, "isMember": true }] }
```

**`GET /api/leagues/:id/leaderboard`**
```json
{ "leaderboard": [{ "rank": 1, "username": "alice", "gamesPlayed": 12, "wins": 8, "winPercentage": 67 }] }
```

## Project Structure

```
src/
├── api/              # All API calls (one file per domain)
│   ├── client.js     # Base fetch wrapper with auth header
│   ├── auth.js
│   ├── games.js
│   ├── library.js
│   ├── wishlist.js
│   ├── plays.js
│   ├── leagues.js
│   └── dashboard.js
├── components/
│   ├── auth/         # Login, Register, ProtectedRoute
│   ├── dashboard/    # Stats overview
│   ├── games/        # Search + GameDetailModal
│   ├── layout/       # AppLayout (sidebar nav)
│   ├── leagues/      # League list + leaderboard
│   ├── library/      # Game library
│   ├── plays/        # Play log + log play modal
│   ├── ui/           # Shared primitives + Modal + Tooltip
│   └── wishlist/     # Wishlist
├── context/
│   └── AuthContext.jsx
├── hooks/
│   └── useApi.js
└── utils/
    └── cn.js
```

## Build for Production

```bash
npm run build
npm run preview
```

Output goes to `dist/` — serve with any static file server.
