import express from 'express'
import cors from 'cors'
import https from 'https'
import http from 'http'
import jwt from 'jsonwebtoken'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const JWT_SECRET = process.env.JWT_SECRET || 'meeple-dev-secret'

app.use(cors())
app.use(express.json())

// ── BGG XML API2 config ─────────────────────────────────────────
const BGG_BASE = 'https://boardgamegeek.com/xmlapi2'
const BGG_APP_TOKEN = process.env.BGG_APP_TOKEN || ''

// Force IPv4 to avoid DNS issues on some Docker setups
const httpsAgent = new https.Agent({ keepAlive: true, family: 4 })

// ── Simple XML parser (no dependencies) ──────────────────────────
// Handles the BGG XML API responses without needing fast-xml-parser
function parseXmlValue(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

function parseXmlAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*?\\s${attr}="([^"]*)"`)
  const m = xml.match(re)
  return m ? m[1] : null
}

function parseAllTags(xml, tag) {
  const re = new RegExp(`<${tag}[\\s\\S]*?(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`, 'g')
  return xml.match(re) || []
}

function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, '') // strip HTML tags from descriptions
}

// ── In-memory cache ──────────────────────────────────────────────
const cache = new Map()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function cacheSet(key, value) {
  cache.set(key, { value, ts: Date.now() })
}

// ── HTTP GET helper ──────────────────────────────────────────────
function httpGet(url, retries = 5) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Accept': 'application/xml',
      'User-Agent': 'MeepleTracker/2.0',
    }
    // Include app token if available
    if (BGG_APP_TOKEN) {
      headers['Authorization'] = `Bearer ${BGG_APP_TOKEN}`
    }

    https.get(url, { agent: httpsAgent, headers }, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data)
        else if (res.statusCode === 202 && retries > 0) {
          // BGG returns 202 "queued" — retry after delay
          console.log(`[BGG] 202 queued, retrying in 2s... (${retries} left)`)
          setTimeout(() => httpGet(url, retries - 1).then(resolve).catch(reject), 2000)
        }
        else reject(new Error(`BGG responded ${res.statusCode}`))
      })
    }).on('error', reject)
  })
}

// ── BGG search via XML API ───────────────────────────────────────
async function bggSearch(query) {
  const url = `${BGG_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`
  console.log(`[BGG API] search: ${query}`)

  const xml = await httpGet(url)
  const items = parseAllTags(xml, 'item')

  const searchResults = items.map(item => {
    const id = parseXmlAttr(item, 'item', 'id')
    // Get primary name
    const nameMatch = item.match(/<name\s[^>]*type="primary"[^>]*value="([^"]*)"/)
    const name = nameMatch ? cleanText(nameMatch[1]) : null
    const yearMatch = item.match(/<yearpublished[^>]*value="([^"]*)"/)
    const yearPublished = yearMatch ? parseInt(yearMatch[1], 10) : null

    if (!id || !name) return null
    return { id, name, yearPublished }
  }).filter(Boolean).slice(0, 100)

  // If we got results, batch-fetch details for the first 20 to get images
  // This is fast because it's one API call with comma-separated IDs
  if (searchResults.length > 0) {
    const topIds = searchResults.slice(0, 100).map(r => r.id)
    try {
      const details = await bggThingBatch(topIds)
      const detailMap = new Map(details.map(d => [d.id, d]))
      searchResults.forEach(r => {
        const d = detailMap.get(r.id)
        if (d) {
          r.thumbnail = d.thumbnail || null
          r.image = d.image || null
          r.bggRating = d.bggRating || null
          r.description = d.description || null
          r.minPlayers = d.minPlayers || null
          r.maxPlayers = d.maxPlayers || null
          r.playingTime = d.playingTime || null
          r.weight = d.weight || null
          r.rank = d.rank || null
        }
      })

      // Sort by BGG rank (ranked games first, then by rating)
      searchResults.sort((a, b) => {
        // Games with a rank come first
        if (a.rank && !b.rank) return -1
        if (!a.rank && b.rank) return 1
        // Both ranked: lower rank number = better
        if (a.rank && b.rank) return a.rank - b.rank
        // Neither ranked: sort by rating (higher first)
        if (a.bggRating && b.bggRating) return b.bggRating - a.bggRating
        if (a.bggRating) return -1
        if (b.bggRating) return 1
        return 0
      })
      })
    } catch (err) {
      console.error('[BGG API] batch detail fetch failed:', err.message)
      // Search results still returned, just without images
    }
  }

  return searchResults
}

// ── BGG thing (batch details) via XML API ────────────────────────
async function bggThingBatch(ids) {
  // BGG API supports comma-separated IDs in one call (up to ~20 at a time)
  const chunks = []
  for (let i = 0; i < ids.length; i += 20) {
    chunks.push(ids.slice(i, i + 20))
  }

  const allResults = []
  for (const chunk of chunks) {
    const url = `${BGG_BASE}/thing?id=${chunk.join(',')}&type=boardgame&stats=1`
    try {
      const xml = await httpGet(url)
      const items = parseAllTags(xml, 'item')
      for (const item of items) {
        const parsed = parseThingItem(item)
        if (parsed) allResults.push(parsed)
      }
    } catch (err) {
      console.error(`[BGG API] thing batch error: ${err.message}`)
    }
  }
  return allResults
}

// ── Parse a single <item> from the thing endpoint ────────────────
function parseThingItem(item) {
  const id = parseXmlAttr(item, 'item', 'id')
  if (!id) return null

  // Name (primary)
  const nameMatch = item.match(/<name\s[^>]*type="primary"[^>]*value="([^"]*)"/)
  const name = nameMatch ? cleanText(nameMatch[1]) : null

  // Year
  const yearMatch = item.match(/<yearpublished[^>]*value="(\d+)"/)
  const yearPublished = yearMatch ? parseInt(yearMatch[1], 10) : null

  // Images
  const image = parseXmlValue(item, 'image')
  const thumbnail = parseXmlValue(item, 'thumbnail')

  // Description
  const description = cleanText(parseXmlValue(item, 'description'))

  // Players
  const minMatch = item.match(/<minplayers[^>]*value="(\d+)"/)
  const maxMatch = item.match(/<maxplayers[^>]*value="(\d+)"/)
  const minPlayers = minMatch ? parseInt(minMatch[1], 10) : null
  const maxPlayers = maxMatch ? parseInt(maxMatch[1], 10) : null

  // Playing time
  const timeMatch = item.match(/<playingtime[^>]*value="(\d+)"/)
  const playingTime = timeMatch ? parseInt(timeMatch[1], 10) : null

  // BGG rating (bayesaverage = "Geek Rating")
  const ratingMatch = item.match(/<average[^>]*value="([^"]*)"/)
  const bggRating = ratingMatch ? parseFloat(ratingMatch[1]) : null

  // Weight / complexity
  const weightMatch = item.match(/<averageweight[^>]*value="([^"]*)"/)
  const weight = weightMatch ? parseFloat(weightMatch[1]) : null

  // Rank
  const rankMatch = item.match(/<rank[^>]*name="boardgame"[^>]*value="(\d+)"/)
  const rank = rankMatch ? parseInt(rankMatch[1], 10) : null

  // Designers, artists, publishers
  const designers = [...item.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]*)"/g)].map(m => m[1])
  const artists = [...item.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]*)"/g)].map(m => m[1])
  const publishers = [...item.matchAll(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]*)"/g)].map(m => m[1]).slice(0, 5)

  return {
    id, name, yearPublished, image, thumbnail, description,
    minPlayers, maxPlayers, playingTime, bggRating, weight, rank,
    designers, artists, publishers,
    link: `https://boardgamegeek.com/boardgame/${id}`,
  }
}

// ── In-memory user store ─────────────────────────────────────────
const userStore = new Map()
const users = new Map()

function getStore(userId) {
  if (!userStore.has(userId)) {
    userStore.set(userId, { library: [], wishlist: [], plays: [] })
  }
  return userStore.get(userId)
}

// ── Auth middleware ───────────────────────────────────────────────
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

// ── AUTH ──────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, name } = req.body || {}
  const key = username || email
  if (!key || !password) return res.status(400).json({ error: 'Username and password required' })
  if (users.has(key)) return res.status(409).json({ error: 'Username already registered' })
  const userId = `user_${Date.now()}`
  users.set(key, { userId, username: key, name: name || key, password })
  const token = jwt.sign({ userId, username: key }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { userId, username: key, name: name || key } })
})

app.post('/api/auth/login', (req, res) => {
  const { username, email, password } = req.body || {}
  const key = username || email
  const user = users.get(key)
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign({ userId: user.userId, username: key }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { userId: user.userId, username: key, name: user.name } })
})

app.get('/api/auth/me', auth, (req, res) => {
  const user = [...users.values()].find(u => u.userId === req.user.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user: { userId: user.userId, username: user.username, name: user.name } })
})

// ── GAMES — powered by BGG XML API2 ─────────────────────────────
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
    const games = await bggSearch(q)
    const result = { games }
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(502).json({ error: `Search failed: ${err.message}` })
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
    const results = await bggThingBatch([id])
    const game = results[0] || null
    if (game) cacheSet(cacheKey, game)
    res.json(game)
  } catch (err) {
    console.error('Game detail error:', err.message)
    res.status(502).json({ error: 'Game lookup failed' })
  }
})

// ── LIBRARY ──────────────────────────────────────────────────────
app.get('/api/library', auth, async (req, res) => {
  const store = getStore(req.user.userId)

  // Enrich library entries that are missing names (refresh from BGG API)
  const needEnrich = store.library.filter(e => !e.name || e.name === 'Loading ...')
  if (needEnrich.length > 0) {
    try {
      const ids = needEnrich.map(e => e.gameId)
      const details = await bggThingBatch(ids)
      const detailMap = new Map(details.map(d => [d.id, d]))
      needEnrich.forEach(entry => {
        const d = detailMap.get(entry.gameId)
        if (d) {
          entry.name = d.name
          entry.image = d.image
          entry.thumbnail = d.thumbnail
          entry.yearPublished = d.yearPublished
        }
      })
    } catch { /* keep existing data */ }
  }

  res.json({ games: store.library })
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

// ── WISHLIST ─────────────────────────────────────────────────────
app.get('/api/wishlist', auth, async (req, res) => {
  const store = getStore(req.user.userId)

  const needEnrich = store.wishlist.filter(e => !e.name || e.name === 'Loading ...')
  if (needEnrich.length > 0) {
    try {
      const ids = needEnrich.map(e => e.gameId)
      const details = await bggThingBatch(ids)
      const detailMap = new Map(details.map(d => [d.id, d]))
      needEnrich.forEach(entry => {
        const d = detailMap.get(entry.gameId)
        if (d) {
          entry.name = d.name
          entry.image = d.image
          entry.thumbnail = d.thumbnail
          entry.yearPublished = d.yearPublished
        }
      })
    } catch { /* keep existing data */ }
  }

  res.json({ games: store.wishlist })
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

// ── PLAYS ────────────────────────────────────────────────────────
app.get('/api/plays', auth, (req, res) => {
  const store = getStore(req.user.userId)
  res.json({ plays: store.plays })
})

app.post('/api/plays', auth, (req, res) => {
  const { gameId, gameName, players, winner, playedAt, notes } = req.body || {}
  if (!gameId) return res.status(400).json({ error: 'gameId required' })
  const store = getStore(req.user.userId)
  const play = {
    id: `play_${Date.now()}`,
    gameId: String(gameId),
    gameName: gameName || null,
    players: players || [],
    winner: winner || null,
    playedAt: playedAt || new Date().toISOString(),
    notes: notes || '',
  }
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

// ── DASHBOARD ────────────────────────────────────────────────────
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
    mostPlayedGame: topGameId ? { name: topLibEntry?.name || playsArr.find(p => p.gameId === topGameId[0])?.gameName || topGameId[0], plays: topGameId[1] } : null,
  }
  const league = { score: 0, wins: 0, losses: 0, winPercentage: null, leaderboardPosition: null }
  res.json({ library, wishlist, plays, league })
})

// ── LEAGUES ──────────────────────────────────────────────────────
app.get('/api/leagues', auth, (req, res) => res.json({ leagues: [] }))
app.post('/api/leagues', auth, (req, res) => res.status(201).json({ league: { id: `league_${Date.now()}`, ...req.body } }))

// ── Health ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dataSource: 'BGG XML API2' })
})

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🎲 Meeple API running at http://localhost:${PORT}`)
  console.log(`   Data source: BGG XML API2`)
  if (BGG_APP_TOKEN) console.log(`   App token: configured`)
})
