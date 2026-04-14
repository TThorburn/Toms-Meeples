import express from 'express'
import cors from 'cors'
import http from 'http'
import jwt from 'jsonwebtoken'

const app = express()
const PORT = 3001
const JWT_SECRET = process.env.JWT_SECRET || 'meeple-dev-secret'

app.use(cors())
app.use(express.json())

// ── BGG Scraper service config ────────────────────────────────
// Points to the bgg-scraper container (or localhost for local dev)
const BGG_SCRAPER_HOST = process.env.BGG_SCRAPER_HOST || 'localhost'
const BGG_SCRAPER_PORT = parseInt(process.env.BGG_SCRAPER_PORT || '3002', 10)

// Simple in-memory cache to avoid hammering the scraper
const scraperCache = new Map()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function cacheGet(key) {
  const entry = scraperCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    scraperCache.delete(key)
    return null
  }
  return entry.value
}

function cacheSet(key, value) {
  scraperCache.set(key, { value, ts: Date.now() })
}

// ── HTTP helper to call bgg-scraper ──────────────────────────
function scraperGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      host: BGG_SCRAPER_HOST,
      port: BGG_SCRAPER_PORT,
      path,
      method: 'GET',
      headers: { Accept: 'application/json' },
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `Scraper HTTP ${res.statusCode}`))
          } else {
            resolve(parsed)
          }
        } catch {
          reject(new Error('Invalid JSON from scraper'))
        }
      })
    })

    req.on('error', (err) => reject(new Error(`Scraper unreachable: ${err.message}`)))
    req.setTimeout(90000, () => {
      req.destroy()
      reject(new Error('Scraper request timed out'))
    })
    req.end()
  })
}

// ── In-memory store ───────────────────────────────────────────
const userStore = new Map()
const users = new Map()

function getStore(userId) {
  if (!userStore.has(userId)) {
    userStore.set(userId, { library: [], wishlist: [], plays: [] })
  }
  return userStore.get(userId)
}

// ── Auth middleware ───────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// ── AUTH ──────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (users.has(email)) return res.status(409).json({ error: 'Email already registered' })
  const userId = `user_${Date.now()}`
  users.set(email, { userId, email, name: name || email, password })
  const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { userId, email, name: name || email } })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  const user = users.get(email)
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign({ userId: user.userId, email }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { userId: user.userId, email, name: user.name } })
})

app.get('/api/auth/me', auth, (req, res) => {
  const user = [...users.values()].find(u => u.userId === req.user.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user: { userId: user.userId, email: user.email, name: user.name } })
})

// ── GAMES — powered by bgg-scraper ────────────────────────────
app.get('/api/games/search', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q) return res.json({ games: [] })

  const cacheKey = `search:${q.toLowerCase()}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    console.log(`[cache hit] search "${q}"`)
    return res.json(cached)
  }

  try {
    console.log(`[scraper] searching "${q}"`)
    const data = await scraperGet(`/search?q=${encodeURIComponent(q)}`)
    // data.games already shaped as { id, name, yearPublished, rank, bggRating, ... }
    const result = { games: data.games || [] }
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(502).json({ error: `Search failed: ${err.message}` })
  }
})

app.get('/api/games/thing', async (req, res) => {
  const ids = (req.query.id || '').split(',').map(x => x.trim()).filter(Boolean)
  if (!ids.length) return res.json({ games: [] })
  try {
    const games = await Promise.all(ids.map(id => scraperGet(`/game/${id}`).catch(() => null)))
    const valid = games.filter(Boolean)
    if (valid.length === 1) return res.json({ game: valid[0] })
    res.json({ games: valid })
  } catch (err) {
    console.error('Thing error:', err.message)
    res.status(502).json({ error: 'Game lookup failed' })
  }
})

app.get('/api/games/:id', async (req, res) => {
  const id = req.params.id

  const cacheKey = `game:${id}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    console.log(`[cache hit] game ${id}`)
    return res.json(cached)
  }

  try {
    console.log(`[scraper] game detail ${id}`)
    const game = await scraperGet(`/game/${id}`)
    // Map scraper output to the shape the frontend expects
    const mapped = {
      id: String(game.bggId || id),
      name: game.title,
      yearPublished: game.year,
      image: game.image,
      thumbnail: game.thumbnail,
      bggRating: game.bggRating,
      description: game.description,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      playingTime: game.playingTime,
      weight: game.weight,
      link: game.link,
    }
    cacheSet(cacheKey, mapped)
    res.json(mapped)
  } catch (err) {
    console.error('Game detail error:', err.message)
    res.status(502).json({ error: 'Game lookup failed' })
  }
})

// ── LIBRARY ───────────────────────────────────────────────────
app.get('/api/library', auth, async (req, res) => {
  const store = getStore(req.user.userId)
  // Enrich library entries with game details from scraper
  const enriched = await Promise.all(store.library.map(async (entry) => {
    if (entry.name) return entry
    try {
      const game = await scraperGet(`/game/${entry.gameId}`)
      if (game) Object.assign(entry, {
        name: game.title,
        image: game.image,
        thumbnail: game.thumbnail,
        yearPublished: game.year,
      })
    } catch { /* keep bare entry */ }
    return entry
  }))
  res.json({ games: enriched })
})

app.post('/api/library', auth, (req, res) => {
  const { gameId, name, image, thumbnail, yearPublished } = req.body || {}
  if (!gameId) return res.status(400).json({ error: 'gameId required' })
  const store = getStore(req.user.userId)
  if (store.library.find(e => String(e.gameId) === String(gameId))) return res.status(409).json({ error: 'Already in library' })
  const entry = { gameId: String(gameId), name, image, thumbnail, yearPublished, addedAt: new Date().toISOString(), plays: 0 }
  store.library.push(entry)
  res.status(201).json({ entry })
})

app.delete('/api/library/:gameId', auth, (req, res) => {
  const store = getStore(req.user.userId)
  store.library = store.library.filter(e => String(e.gameId) !== String(req.params.gameId))
  res.status(204).end()
})

// ── WISHLIST ──────────────────────────────────────────────────
app.get('/api/wishlist', auth, async (req, res) => {
  const store = getStore(req.user.userId)
  const enriched = await Promise.all(store.wishlist.map(async (entry) => {
    if (entry.name) return entry
    try {
      const game = await scraperGet(`/game/${entry.gameId}`)
      if (game) Object.assign(entry, {
        name: game.title,
        image: game.image,
        thumbnail: game.thumbnail,
        yearPublished: game.year,
      })
    } catch { /* keep bare entry */ }
    return entry
  }))
  res.json({ games: enriched })
})

app.post('/api/wishlist', auth, (req, res) => {
  const { gameId, name, image, thumbnail, yearPublished } = req.body || {}
  if (!gameId) return res.status(400).json({ error: 'gameId required' })
  const store = getStore(req.user.userId)
  if (store.wishlist.find(e => String(e.gameId) === String(gameId))) return res.status(409).json({ error: 'Already in wishlist' })
  const entry = { gameId: String(gameId), name, image, thumbnail, yearPublished, addedAt: new Date().toISOString() }
  store.wishlist.push(entry)
  res.status(201).json({ entry })
})

app.delete('/api/wishlist/:gameId', auth, (req, res) => {
  const store = getStore(req.user.userId)
  store.wishlist = store.wishlist.filter(e => String(e.gameId) !== String(req.params.gameId))
  res.status(204).end()
})

// ── PLAYS ─────────────────────────────────────────────────────
app.get('/api/plays', auth, (req, res) => {
  const store = getStore(req.user.userId)
  res.json({ plays: store.plays })
})

app.post('/api/plays', auth, (req, res) => {
  const { gameId, players, winner, playedAt, notes } = req.body || {}
  if (!gameId) return res.status(400).json({ error: 'gameId required' })
  const store = getStore(req.user.userId)
  const play = { id: `play_${Date.now()}`, gameId: String(gameId), players: players || [], winner: winner || null, playedAt: playedAt || new Date().toISOString(), notes: notes || '' }
  store.plays.unshift(play)
  const libEntry = store.library.find(e => e.gameId === String(gameId))
  if (libEntry) libEntry.plays = (libEntry.plays || 0) + 1
  res.status(201).json({ play })
})

app.delete('/api/plays/:id', auth, (req, res) => {
  const store = getStore(req.user.userId)
  store.plays = store.plays.filter(p => p.id !== req.params.id)
  res.status(204).end()
})

// ── DASHBOARD ─────────────────────────────────────────────────
app.get('/api/dashboard', auth, (req, res) => {
  const store = getStore(req.user.userId)
  const libGames = store.library
  const mostPlayedLib = [...libGames].sort((a, b) => (b.plays || 0) - (a.plays || 0))[0]
  const library = {
    totalGames: libGames.length,
    totalPlays: libGames.reduce((sum, g) => sum + (g.plays || 0), 0),
    mostPlayedGame: mostPlayedLib ? { name: mostPlayedLib.name || mostPlayedLib.gameId, plays: mostPlayedLib.plays || 0 } : null,
  }
  const wishGames = store.wishlist
  const wishlist = {
    totalGames: wishGames.length,
    recentlyAdded: wishGames.slice(0, 3).map(g => ({ name: g.name || g.gameId })),
  }
  const playsArr = store.plays
  const uniqueGameIds = new Set(playsArr.map(p => p.gameId))
  const gamePlayCounts = {}
  let wins = 0, totalWithWinner = 0
  for (const play of playsArr) {
    gamePlayCounts[play.gameId] = (gamePlayCounts[play.gameId] || 0) + 1
    if (play.winner) { totalWithWinner++; if (play.winner === 'me' || play.winner === req.user.userId) wins++ }
  }
  const topGameId = Object.entries(gamePlayCounts).sort((a, b) => b[1] - a[1])[0]
  const topLibEntry = topGameId ? store.library.find(e => e.gameId === topGameId[0]) : null
  const plays = {
    uniqueGames: uniqueGameIds.size,
    totalSessions: playsArr.length,
    winRate: totalWithWinner > 0 ? Math.round((wins / totalWithWinner) * 100) : null,
    mostPlayedGame: topGameId ? { name: topLibEntry?.name || topGameId[0], plays: topGameId[1] } : null,
  }
  const league = { score: 0, wins: 0, losses: 0, winPercentage: null, leaderboardPosition: null }
  res.json({ library, wishlist, plays, league })
})

// ── LEAGUES ───────────────────────────────────────────────────
app.get('/api/leagues', auth, (req, res) => res.json({ leagues: [] }))
app.post('/api/leagues', auth, (req, res) => res.status(201).json({ league: { id: `league_${Date.now()}`, ...req.body } }))

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    scraperHost: BGG_SCRAPER_HOST,
    scraperPort: BGG_SCRAPER_PORT,
  })
})

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🎲 Meeple API running at http://localhost:${PORT}`)
  console.log(`   BGG Scraper: http://${BGG_SCRAPER_HOST}:${BGG_SCRAPER_PORT}`)
})
