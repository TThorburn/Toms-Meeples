# Toms-Meeples
## Boardgame Tracker & Library

A board game collection tracker powered by BGG data, scraped via headless Chrome (no API key required).

## Architecture

```
Browser → boardgame-tracker (nginx :80)
              ↓ /api/* proxy
           bg-api (Express :3001)
              ↓ search / game detail
          bgg-scraper (Puppeteer :3002)
              ↓ headless Chrome
         boardgamegeek.com
```

## Folder structure

```
docker-compose.yml
bgg-scraper/          ← headless Chrome scraper (HTTP API)
  Dockerfile
  index.js
  bgg-search.js       ← CLI tool
  package.json
bg-api/               ← REST API + auth + library/wishlist/plays
  Dockerfile
  server.js
  package.json
boardgame-tracker/    ← React frontend (your existing src/ files go here)
  Dockerfile
  nginx.conf
  index.html
  src/
  ...
```

## Quick start

```bash
docker compose up --build
```

Then open **http://localhost** in your browser.

---

## CLI testing

The `bgg-search` CLI lets you test scraping from the terminal without touching the web UI.

### Option A — inside the running container (always works)

```bash
docker compose exec bgg-scraper node bgg-search.js catan
docker compose exec bgg-scraper node bgg-search.js terraforming mars
docker compose exec bgg-scraper node bgg-search.js "spirit island"
```

### Option B — install globally on your host

```bash
cd bgg-scraper
npm install -g .

# Now use from anywhere (scraper container must be running):
bgg-search catan
bgg-search terraforming mars
bgg-search "ark nova"
```

### Option C — direct curl (scraper container must be running)

```bash
# Search
curl "http://localhost:3002/search?q=catan" | jq '.games[] | {name, rank, bggRating}'

# Game detail by BGG ID
curl "http://localhost:3002/game/169786" | jq '{name, year, bggRating, description}'

# Health check
curl http://localhost:3002/health
```

---

## How it works

- **bgg-scraper** launches one headless Chromium instance on startup and keeps it alive.  
  It only scrapes when a request comes in — no background indexing, no runaway processes.
- **bg-api** talks to the scraper over Docker's internal network (`bgg-scraper:3002`).  
  Results are cached for 10 minutes so repeated searches don't hit BGG again.
- **boardgame-tracker** is built by Vite at container build time and served as static files  
  by nginx. nginx also proxies `/api/*` → `bg-api:3001` so the frontend's relative API  
  calls work identically to the Vite dev server proxy.

## Useful commands

```bash
# Start everything
docker compose up --build

# Start just the scraper (for CLI testing without the rest)
docker compose up --build bgg-scraper

# Follow scraper logs (see Chrome activity)
docker compose logs -f bgg-scraper

# Follow API logs
docker compose logs -f bg-api

# Stop everything
docker compose down

# Rebuild a single service after code changes
docker compose up --build bg-api
```

## Local development (without Docker)

If you want to run the frontend with Vite hot-reload while the backend runs in Docker:

```bash
# Terminal 1 — start backend services
docker compose up --build bgg-scraper bg-api

# Terminal 2 — run frontend dev server
cd boardgame-tracker
npm install
npm run dev
# Vite proxies /api → localhost:3001 automatically (see vite.config.js)
```

## Environment variables

| Variable | Service | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | bg-api | `meeple-dev-secret-change-in-production` | JWT signing secret — change this in production |
| `BGG_TIMEOUT_MS` | bgg-scraper | `60000` | Max ms to wait for BGG page load |
| `BGG_MAX_RETRIES` | bgg-scraper | `3` | Retry attempts if scrape fails |
| `BGG_HEADLESS` | bgg-scraper | `true` | Set to `false` to see the browser (local only) |

Set secrets in a `.env` file at the root:

```env
JWT_SECRET=your-very-secret-key-here
```
