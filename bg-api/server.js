import express from 'express'
import cors from 'cors'
import https from 'https'
import jwt from 'jsonwebtoken'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const JWT_SECRET = process.env.JWT_SECRET || 'meeple-dev-secret'

app.use(cors())
app.use(express.json())

// ── BGG XML API2 config ─────────────────────────────────────────
const BGG_BASE = 'https://boardgamegeek.com/xmlapi2'
const BGG_APP_TOKEN = process.env.BGG_APP_TOKEN || ''
const httpsAgent = new https.Agent({ keepAlive: true, family: 4 })

// ── Simple XML helpers ───────────────────────────────────────────
function parseXmlValue(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  const m = xml.match(re)
  return m ? m[1].trim() : null
}
function parseAllTags(xml, tag) {
  const re = new RegExp(`<${tag}[\\s\\S]*?(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`, 'g')
  return xml.match(re) || []
}
function cleanText(text) {
  if (!text) return ''
  return text.replace(/&#10;/g, '\n').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]*>/g, '')
}

// ── Cache ────────────────────────────────────────────────────────
const cache = new Map()
const CACHE_TTL = 30 * 60 * 1000
function cacheGet(k) { const e = cache.get(k); if (!e) return null; if (Date.now() - e.ts > CACHE_TTL) { cache.delete(k); return null }; return e.value }
function cacheSet(k, v) { cache.set(k, { value: v, ts: Date.now() }) }

// ── HTTP GET ─────────────────────────────────────────────────────
function httpGet(url, retries = 5) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: 'application/xml', 'User-Agent': 'MeepleTracker/2.0' }
    if (BGG_APP_TOKEN) headers['Authorization'] = `Bearer ${BGG_APP_TOKEN}`
    https.get(url, { agent: httpsAgent, headers }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data)
        else if (res.statusCode === 202 && retries > 0) {
          console.log(`[BGG] 202 queued, retry in 2s (${retries} left)`)
          setTimeout(() => httpGet(url, retries - 1).then(resolve).catch(reject), 2000)
        } else reject(new Error(`BGG ${res.statusCode}`))
      })
    }).on('error', reject)
  })
}

// ── BGG Search ───────────────────────────────────────────────────
async function bggSearch(query) {
  const url = `${BGG_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`
  console.log(`[BGG] search: ${query}`)
  const xml = await httpGet(url)
  const items = parseAllTags(xml, 'item')

  const results = items.map(item => {
    const id = (item.match(/<item[^>]*id="(\d+)"/) || [])[1]
    const nameMatch = item.match(/<name\s[^>]*type="primary"[^>]*value="([^"]*)"/)
    const name = nameMatch ? cleanText(nameMatch[1]) : null
    const yearMatch = item.match(/<yearpublished[^>]*value="([^"]*)"/)
    const yearPublished = yearMatch ? parseInt(yearMatch[1], 10) : null
    if (!id || !name) return null
    return { id, name, yearPublished }
  }).filter(Boolean).slice(0, 100)

  // Batch-fetch details for images, ratings, rank
  if (results.length > 0) {
    try {
      const details = await bggThingBatch(results.map(r => r.id))
      const dm = new Map(details.map(d => [d.id, d]))
      results.forEach(r => {
        const d = dm.get(r.id)
        if (d) Object.assign(r, {
          thumbnail: d.thumbnail, image: d.image, bggRating: d.bggRating,
          description: d.description, minPlayers: d.minPlayers, maxPlayers: d.maxPlayers,
          playingTime: d.playingTime, weight: d.weight, rank: d.rank,
        })
      })
      // Sort: ranked first by rank, then unranked by rating
      results.sort((a, b) => {
        if (a.rank && !b.rank) return -1
        if (!a.rank && b.rank) return 1
        if (a.rank && b.rank) return a.rank - b.rank
        if (a.bggRating && b.bggRating) return b.bggRating - a.bggRating
        if (a.bggRating) return -1
        if (b.bggRating) return 1
        return 0
      })
    } catch (err) {
      console.error('[BGG] batch detail failed:', err.message)
    }
  }
  return results
}

// ── BGG Thing (batch) ────────────────────────────────────────────
async function bggThingBatch(ids) {
  const results = []
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20)
    const url = `${BGG_BASE}/thing?id=${chunk.join(',')}&type=boardgame&stats=1`
    try {
      const xml = await httpGet(url)
      for (const item of parseAllTags(xml, 'item')) {
        const p = parseThingItem(item)
        if (p) results.push(p)
      }
    } catch (err) { console.error(`[BGG] thing batch error: ${err.message}`) }
  }
  return results
}

function parseThingItem(item) {
  const id = (item.match(/<item[^>]*id="(\d+)"/) || [])[1]
  if (!id) return null
  const nameMatch = item.match(/<name\s[^>]*type="primary"[^>]*value="([^"]*)"/)
  const name = nameMatch ? cleanText(nameMatch[1]) : null
  const yearMatch = item.match(/<yearpublished[^>]*value="(\d+)"/)
  const yearPublished = yearMatch ? parseInt(yearMatch[1], 10) : null
  const image = parseXmlValue(item, 'image')
  const thumbnail = parseXmlValue(item, 'thumbnail')
  const description = cleanText(parseXmlValue(item, 'description'))
  const minPlayers = (item.match(/<minplayers[^>]*value="(\d+)"/) || [])[1]
  const maxPlayers = (item.match(/<maxplayers[^>]*value="(\d+)"/) || [])[1]
  const playingTime = (item.match(/<playingtime[^>]*value="(\d+)"/) || [])[1]
  const ratingMatch = item.match(/<average[^>]*value="([^"]*)"/)
  const bggRating = ratingMatch ? parseFloat(ratingMatch[1]) : null
  const weightMatch = item.match(/<averageweight[^>]*value="([^"]*)"/)
  const weight = weightMatch ? parseFloat(weightMatch[1]) : null
  const rankMatch = item.match(/<rank[^>]*name="boardgame"[^>]*value="(\d+)"/)
  const rank = rankMatch ? parseInt(rankMatch[1], 10) : null
  const designers = [...item.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]*)"/g)].map(m => m[1])
  const artists = [...item.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]*)"/g)].map(m => m[1])
  const publishers = [...item.matchAll(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]*)"/g)].map(m => m[1]).slice(0, 5)
  // Recommended players from poll
  let bestPlayers = null, recommendedPlayers = null
  const pollMatch = item.match(/<poll[^>]*name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll>/)
  if (pollMatch) {
    let bestVotes = 0, recVotes = 0
    const pollResults = [...pollMatch[1].matchAll(/<results[^>]*numplayers="([^"]*)"[^>]*>([\s\S]*?)<\/results>/g)]
    for (const pr of pollResults) {
      const np = pr[1]
      const bestMatch = pr[2].match(/<result[^>]*value="Best"[^>]*numvotes="(\d+)"/)
      const recMatch = pr[2].match(/<result[^>]*value="Recommended"[^>]*numvotes="(\d+)"/)
      const bv = bestMatch ? parseInt(bestMatch[1], 10) : 0
      const rv = recMatch ? parseInt(recMatch[1], 10) : 0
      if (bv > bestVotes) { bestVotes = bv; bestPlayers = np }
      if ((bv + rv) > recVotes) { recVotes = bv + rv; recommendedPlayers = np }
    }
  }
  return {
    id, name, yearPublished, image, thumbnail, description,
    minPlayers: minPlayers ? parseInt(minPlayers) : null,
    maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
    playingTime: playingTime ? parseInt(playingTime) : null,
    bggRating, weight, rank, designers, artists, publishers,
    bestPlayers, recommendedPlayers,
    link: `https://boardgamegeek.com/boardgame/${id}`,
  }
}

// ── In-memory stores ─────────────────────────────────────────────
const userStore = new Map()
const users = new Map()
const leagues = new Map()

function getStore(userId) {
  if (!userStore.has(userId)) userStore.set(userId, { library: [], wishlist: [], plays: [] })
  return userStore.get(userId)
}

// ── Auth middleware ───────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try { req.user = jwt.verify(token, JWT_SECRET); next() }
  catch { res.status(401).json({ error: 'Invalid token' }) }
}

// ── AUTH routes ──────────────────────────────────────────────────
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

// Account settings
app.put('/api/auth/account', auth, (req, res) => {
  const { name, currentPassword, newPassword } = req.body || {}
  const user = [...users.values()].find(u => u.userId === req.user.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (name) user.name = name
  if (newPassword) {
    if (!currentPassword || currentPassword !== user.password) return res.status(400).json({ error: 'Current password incorrect' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    user.password = newPassword
  }
  res.json({ user: { userId: user.userId, username: user.username, name: user.name } })
})

// ── GAMES ────────────────────────────────────────────────────────
app.get('/api/games/search', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q) return res.json({ games: [] })
  const ck = `search:${q.toLowerCase()}`
  const cached = cacheGet(ck)
  if (cached) return res.json(cached)
  try {
    const games = await bggSearch(q)
    const result = { games }
    cacheSet(ck, result)
    res.json(result)
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(502).json({ error: `Search failed: ${err.message}` })
  }
})

app.get('/api/games/:id', async (req, res) => {
  const id = req.params.id
  const ck = `game:${id}`
  const cached = cacheGet(ck)
  if (cached) return res.json(cached)
  try {
    const results = await bggThingBatch([id])
    const game = results[0] || null
    if (game) cacheSet(ck, game)
    res.json(game)
  } catch (err) {
    res.status(502).json({ error: 'Game lookup failed' })
  }
})

// ── LIBRARY ──────────────────────────────────────────────────────
app.get('/api/library', auth, async (req, res) => {
  const store = getStore(req.user.userId)
  const needEnrich = store.library.filter(e => !e.name || e.name === 'Loading ...')
  if (needEnrich.length > 0) {
    try {
      const details = await bggThingBatch(needEnrich.map(e => e.gameId))
      const dm = new Map(details.map(d => [d.id, d]))
      needEnrich.forEach(entry => {
        const d = dm.get(entry.gameId)
        if (d) { entry.name = d.name; entry.image = d.image; entry.thumbnail = d.thumbnail; entry.yearPublished = d.yearPublished; entry.minPlayers = d.minPlayers; entry.maxPlayers = d.maxPlayers }
      })
    } catch {}
  }
  res.json({ games: store.library })
})

app.post('/api/library', auth, (req, res) => {
  const { gameId, name, image, thumbnail, yearPublished, minPlayers, maxPlayers } = req.body || {}
  if (!gameId) return res.status(400).json({ error: 'gameId required' })
  const store = getStore(req.user.userId)
  if (store.library.find(e => String(e.gameId) === String(gameId))) return res.status(409).json({ error: 'Already in library' })
  const entry = { gameId: String(gameId), name, image, thumbnail, yearPublished, minPlayers: minPlayers || null, maxPlayers: maxPlayers || null, addedAt: new Date().toISOString(), plays: 0 }
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
      const details = await bggThingBatch(needEnrich.map(e => e.gameId))
      const dm = new Map(details.map(d => [d.id, d]))
      needEnrich.forEach(entry => {
        const d = dm.get(entry.gameId)
        if (d) { entry.name = d.name; entry.image = d.image; entry.thumbnail = d.thumbnail; entry.yearPublished = d.yearPublished }
      })
    } catch {}
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
  const { gameId, gameName, gameImage, players, winner, playedAt, datePlayed, notes } = req.body || {}
  if (!gameId) return res.status(400).json({ error: 'gameId required' })
  const store = getStore(req.user.userId)
  const libEntry = store.library.find(e => e.gameId === String(gameId))
  const play = {
    id: `play_${Date.now()}`,
    gameId: String(gameId),
    gameName: gameName || libEntry?.name || null,
    gameImage: gameImage || libEntry?.thumbnail || libEntry?.image || null,
    players: players || [],
    winner: winner || null,
    playedAt: playedAt || datePlayed || new Date().toISOString(),
    datePlayed: datePlayed || playedAt || new Date().toISOString(),
    notes: notes || '',
  }
  store.plays.unshift(play)
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
    totalPlays: libGames.reduce((s, g) => s + (g.plays || 0), 0),
    mostPlayedGame: mostPlayedLib && mostPlayedLib.plays > 0 ? { name: mostPlayedLib.name || mostPlayedLib.gameId, plays: mostPlayedLib.plays } : null,
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
    if (play.players?.some(p => p.winner)) {
      totalWithWinner++
      // Check if any player named like the user won
    }
  }
  const topGameId = Object.entries(gamePlayCounts).sort((a, b) => b[1] - a[1])[0]
  const plays = {
    uniqueGames: uniqueGameIds.size,
    totalSessions: playsArr.length,
    winRate: totalWithWinner > 0 ? Math.round((wins / totalWithWinner) * 100) : null,
    mostPlayedGame: topGameId ? {
      name: playsArr.find(p => p.gameId === topGameId[0])?.gameName || store.library.find(e => e.gameId === topGameId[0])?.name || topGameId[0],
      plays: topGameId[1],
    } : null,
  }
  const league = { score: 0, wins: 0, losses: 0, winPercentage: null, leaderboardPosition: null }
  res.json({ library, wishlist, plays, league })
})

// ── LEAGUES ──────────────────────────────────────────────────────
app.get('/api/leagues', auth, (req, res) => {
  const userId = req.user.userId
  const result = [...leagues.values()].map(l => ({
    ...l,
    memberCount: l.members.length,
    gamesPlayed: l.plays.length,
    isMember: l.members.includes(userId),
  }))
  res.json({ leagues: result })
})

app.post('/api/leagues', auth, (req, res) => {
  const { name, description } = req.body || {}
  if (!name) return res.status(400).json({ error: 'League name required' })
  const id = `league_${Date.now()}`
  const league = {
    id, name, description: description || '',
    createdBy: req.user.userId,
    members: [req.user.userId],
    plays: [],
    createdAt: new Date().toISOString(),
  }
  leagues.set(id, league)
  res.status(201).json({ league: { ...league, memberCount: 1, gamesPlayed: 0, isMember: true } })
})

app.get('/api/leagues/:id', auth, (req, res) => {
  const league = leagues.get(req.params.id)
  if (!league) return res.status(404).json({ error: 'League not found' })
  res.json({
    league: {
      ...league,
      memberCount: league.members.length,
      gamesPlayed: league.plays.length,
      isMember: league.members.includes(req.user.userId),
    }
  })
})

app.post('/api/leagues/:id/join', auth, (req, res) => {
  const league = leagues.get(req.params.id)
  if (!league) return res.status(404).json({ error: 'League not found' })
  if (!league.members.includes(req.user.userId)) league.members.push(req.user.userId)
  res.json({ ok: true })
})

app.delete('/api/leagues/:id/leave', auth, (req, res) => {
  const league = leagues.get(req.params.id)
  if (!league) return res.status(404).json({ error: 'League not found' })
  league.members = league.members.filter(m => m !== req.user.userId)
  res.json({ ok: true })
})

app.post('/api/leagues/:id/plays', auth, (req, res) => {
  const league = leagues.get(req.params.id)
  if (!league) return res.status(404).json({ error: 'League not found' })
  if (!league.members.includes(req.user.userId)) return res.status(403).json({ error: 'Not a member' })
  const { gameId, gameName, players, datePlayed } = req.body || {}
  if (!gameId) return res.status(400).json({ error: 'gameId required' })
  const play = {
    id: `lp_${Date.now()}`,
    gameId: String(gameId),
    gameName: gameName || null,
    players: players || [],
    datePlayed: datePlayed || new Date().toISOString(),
    loggedBy: req.user.userId,
  }
  league.plays.unshift(play)
  res.status(201).json({ play })
})

app.get('/api/leagues/:id/leaderboard', auth, (req, res) => {
  const league = leagues.get(req.params.id)
  if (!league) return res.status(404).json({ error: 'League not found' })

  // Build leaderboard from plays
  const playerStats = new Map()
  for (const play of league.plays) {
    for (const p of (play.players || [])) {
      const name = p.name || 'Unknown'
      if (!playerStats.has(name)) playerStats.set(name, { username: name, gamesPlayed: 0, wins: 0 })
      const s = playerStats.get(name)
      s.gamesPlayed++
      if (p.winner) s.wins++
    }
  }

  const leaderboard = [...playerStats.values()]
    .map(s => ({ ...s, winPercentage: s.gamesPlayed > 0 ? Math.round((s.wins / s.gamesPlayed) * 100) : 0 }))
    .sort((a, b) => b.wins - a.wins || b.winPercentage - a.winPercentage)
    .map((s, i) => ({ ...s, rank: i + 1 }))

  res.json({ leaderboard })
})

app.get('/api/leagues/:id/plays', auth, (req, res) => {
  const league = leagues.get(req.params.id)
  if (!league) return res.status(404).json({ error: 'League not found' })
  res.json({ plays: league.plays })
})

// Most played games in a league
app.get('/api/leagues/:id/stats', auth, (req, res) => {
  const league = leagues.get(req.params.id)
  if (!league) return res.status(404).json({ error: 'League not found' })

  const gameCounts = {}
  for (const play of league.plays) {
    const name = play.gameName || play.gameId
    gameCounts[name] = (gameCounts[name] || 0) + 1
  }
  const mostPlayed = Object.entries(gameCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))

  res.json({ totalPlays: league.plays.length, totalMembers: league.members.length, mostPlayed })
})

// ── Health ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', dataSource: 'BGG XML API2' }))

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🎲 Meeple API running at http://localhost:${PORT}`)
  console.log(`   Data source: BGG XML API2`)
  if (BGG_APP_TOKEN) console.log(`   App token: configured`)
})
