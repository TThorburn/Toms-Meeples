import express from 'express'
import cors from 'cors'
import https from 'https'
import jwt from 'jsonwebtoken'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const JWT_SECRET = process.env.JWT_SECRET || 'meeple-dev-secret'
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// ── BGG XML API2 ─────────────────────────────────────────────────
const BGG_BASE = 'https://boardgamegeek.com/xmlapi2'
const BGG_APP_TOKEN = process.env.BGG_APP_TOKEN || ''
const httpsAgent = new https.Agent({ keepAlive: true, family: 4 })

function parseXmlValue(xml, tag) { const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}`)); return m ? m[1].trim() : null }
function parseAllTags(xml, tag) { return xml.match(new RegExp(`<${tag}[\\s\\S]*?(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`, 'g')) || [] }
function cleanText(t) { return (t||'').replace(/&#10;/g,'\n').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'') }

const cache = new Map()
const CACHE_TTL = 30*60*1000
function cacheGet(k) { const e=cache.get(k); if(!e)return null; if(Date.now()-e.ts>CACHE_TTL){cache.delete(k);return null}; return e.value }
function cacheSet(k,v) { cache.set(k,{value:v,ts:Date.now()}) }

function httpGet(url, retries=5) {
  return new Promise((resolve,reject) => {
    const h = { Accept:'application/xml', 'User-Agent':'MeepleTracker/2.0' }
    if (BGG_APP_TOKEN) h['Authorization'] = `Bearer ${BGG_APP_TOKEN}`
    https.get(url,{agent:httpsAgent,headers:h},(res)=>{
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        if(res.statusCode===200) resolve(d)
        else if(res.statusCode===202&&retries>0){ setTimeout(()=>httpGet(url,retries-1).then(resolve).catch(reject),2000) }
        else reject(new Error(`BGG ${res.statusCode}`))
      })
    }).on('error',reject)
  })
}

async function bggSearch(query) {
  const xml = await httpGet(`${BGG_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame,boardgameexpansion`)
  const items = parseAllTags(xml,'item')
  const results = items.map(item=>{
    const id=(item.match(/<item[^>]*id="(\d+)"/)||[])[1]
    const typeMatch = item.match(/<item[^>]*type="([^"]*)"/)
    const itemType = typeMatch ? typeMatch[1] : 'boardgame'
    const nm=item.match(/<name\s[^>]*type="primary"[^>]*value="([^"]*)"/)
    const name=nm?cleanText(nm[1]):null
    const yr=item.match(/<yearpublished[^>]*value="([^"]*)"/)
    const yearPublished=yr?parseInt(yr[1],10):null
    if(!id||!name)return null
    return {id,name,yearPublished,itemType}
  }).filter(Boolean).slice(0,50)
  if(results.length>0){
    try{
      const details=await bggThingBatch(results.map(r=>r.id))
      const dm=new Map(details.map(d=>[d.id,d]))
      results.forEach(r=>{const d=dm.get(r.id);if(d)Object.assign(r,{thumbnail:d.thumbnail,image:d.image,bggRating:d.bggRating,description:d.description,minPlayers:d.minPlayers,maxPlayers:d.maxPlayers,playingTime:d.playingTime,weight:d.weight,rank:d.rank})})
      // Sort: base games before expansions, then by rank, then by rating
      results.sort((a,b)=>{
        // Base games before expansions
        const aBase = a.itemType === 'boardgame' ? 0 : 1
        const bBase = b.itemType === 'boardgame' ? 0 : 1
        if (aBase !== bBase) return aBase - bBase
        // Ranked before unranked
        if(a.rank&&!b.rank)return-1;if(!a.rank&&b.rank)return 1
        if(a.rank&&b.rank)return a.rank-b.rank
        if(a.bggRating&&b.bggRating)return b.bggRating-a.bggRating
        return 0
      })
    }catch(err){console.error('[BGG] batch fail:',err.message)}
  }
  return results
}

async function bggThingBatch(ids) {
  const results=[]
  for(let i=0;i<ids.length;i+=20){
    const chunk=ids.slice(i,i+20)
    try{
      const xml=await httpGet(`${BGG_BASE}/thing?id=${chunk.join(',')}&type=boardgame&stats=1`)
      for(const item of parseAllTags(xml,'item')){const p=parseThingItem(item);if(p)results.push(p)}
    }catch(err){console.error(`[BGG] thing err:`,err.message)}
  }
  return results
}

function parseThingItem(item) {
  const id=(item.match(/<item[^>]*id="(\d+)"/)||[])[1]; if(!id)return null
  const nm=item.match(/<name\s[^>]*type="primary"[^>]*value="([^"]*)"/); const name=nm?cleanText(nm[1]):null
  const yr=item.match(/<yearpublished[^>]*value="(\d+)"/); const yearPublished=yr?parseInt(yr[1],10):null
  const image=parseXmlValue(item,'image'), thumbnail=parseXmlValue(item,'thumbnail')
  const description=cleanText(parseXmlValue(item,'description'))
  const minP=(item.match(/<minplayers[^>]*value="(\d+)"/)||[])[1], maxP=(item.match(/<maxplayers[^>]*value="(\d+)"/)||[])[1]
  const pt=(item.match(/<playingtime[^>]*value="(\d+)"/)||[])[1]
  const rm=item.match(/<average[^>]*value="([^"]*)"/); const bggRating=rm?parseFloat(rm[1]):null
  const wm=item.match(/<averageweight[^>]*value="([^"]*)"/); const weight=wm?parseFloat(wm[1]):null
  const rkm=item.match(/<rank[^>]*name="boardgame"[^>]*value="(\d+)"/); const rank=rkm?parseInt(rkm[1],10):null
  const designers=[...item.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]*)"/g)].map(m=>m[1])
  const artists=[...item.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]*)"/g)].map(m=>m[1])
  const publishers=[...item.matchAll(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]*)"/g)].map(m=>m[1]).slice(0,5)
  let bestPlayers=null,recommendedPlayers=null
  const pm=item.match(/<poll[^>]*name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll>/)
  if(pm){let bv=0,rv=0;const prs=[...pm[1].matchAll(/<results[^>]*numplayers="([^"]*)"[^>]*>([\s\S]*?)<\/results>/g)];for(const pr of prs){const np=pr[1],bm=pr[2].match(/<result[^>]*value="Best"[^>]*numvotes="(\d+)"/),rcm=pr[2].match(/<result[^>]*value="Recommended"[^>]*numvotes="(\d+)"/),b=bm?parseInt(bm[1],10):0,r=rcm?parseInt(rcm[1],10):0;if(b>bv){bv=b;bestPlayers=np};if((b+r)>rv){rv=b+r;recommendedPlayers=np}}}
  return {id,name,yearPublished,image,thumbnail,description,minPlayers:minP?parseInt(minP):null,maxPlayers:maxP?parseInt(maxP):null,playingTime:pt?parseInt(pt):null,bggRating,weight,rank,designers,artists,publishers,bestPlayers,recommendedPlayers,link:`https://boardgamegeek.com/boardgame/${id}`}
}

// ── Stores ───────────────────────────────────────────────────────
const userStore = new Map()
const users = new Map() // key=username, val={userId,username,name,password,role}
const leagues = new Map()

function getStore(userId) { if(!userStore.has(userId))userStore.set(userId,{library:[],wishlist:[],plays:[]});return userStore.get(userId) }

// ── Auth middleware ──────────────────────────────────────────────
function auth(req,res,next) {
  const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):null
  if(!token)return res.status(401).json({error:'Unauthorized'})
  try{req.user=jwt.verify(token,JWT_SECRET);next()}catch{res.status(401).json({error:'Invalid token'})}
}
function adminOnly(req,res,next) {
  const user=[...users.values()].find(u=>u.userId===req.user.userId)
  if(!user||user.role!=='admin')return res.status(403).json({error:'Admin access required'})
  next()
}

// ── Setup status (is this a fresh install?) ──────────────────────
app.get('/api/auth/setup-status', (req,res) => {
  res.json({ needsSetup: users.size === 0 })
})

// ── Initial admin setup ──────────────────────────────────────────
app.post('/api/auth/setup', (req,res) => {
  if(users.size > 0) return res.status(400).json({error:'Setup already completed'})
  const {username,password,name}=req.body||{}
  if(!username||!password) return res.status(400).json({error:'Username and password required'})
  if(password.length<6) return res.status(400).json({error:'Password must be at least 6 characters'})
  const userId=`user_${Date.now()}`
  users.set(username,{userId,username,name:name||username,password,role:'admin'})
  const token=jwt.sign({userId,username},JWT_SECRET,{expiresIn:'7d'})
  res.json({token,user:{userId,username,name:name||username,role:'admin'}})
})

// ── Auth ─────────────────────────────────────────────────────────
app.post('/api/auth/register', (req,res) => {
  const {username,email,password,name}=req.body||{}; const key=username||email
  if(!key||!password) return res.status(400).json({error:'Username and password required'})
  if(users.has(key)) return res.status(409).json({error:'Username already registered'})
  const userId=`user_${Date.now()}`
  const role = users.size===0 ? 'admin' : 'user' // first user is admin
  users.set(key,{userId,username:key,name:name||key,password,role})
  const token=jwt.sign({userId,username:key},JWT_SECRET,{expiresIn:'7d'})
  res.json({token,user:{userId,username:key,name:name||key,role}})
})

app.post('/api/auth/login', (req,res) => {
  const {username,email,password}=req.body||{}; const key=username||email
  const user=users.get(key)
  if(!user||user.password!==password) return res.status(401).json({error:'Invalid credentials'})
  const token=jwt.sign({userId:user.userId,username:key},JWT_SECRET,{expiresIn:'7d'})
  res.json({token,user:{userId:user.userId,username:key,name:user.name,role:user.role}})
})

app.get('/api/auth/me', auth, (req,res) => {
  const user=[...users.values()].find(u=>u.userId===req.user.userId)
  if(!user) return res.status(404).json({error:'User not found'})
  res.json({user:{userId:user.userId,username:user.username,name:user.name,role:user.role}})
})

app.put('/api/auth/account', auth, (req,res) => {
  const {name,currentPassword,newPassword}=req.body||{}
  const user=[...users.values()].find(u=>u.userId===req.user.userId)
  if(!user) return res.status(404).json({error:'User not found'})
  if(name) user.name=name
  if(newPassword){if(!currentPassword||currentPassword!==user.password)return res.status(400).json({error:'Current password incorrect'});if(newPassword.length<6)return res.status(400).json({error:'Password must be at least 6 characters'});user.password=newPassword}
  res.json({user:{userId:user.userId,username:user.username,name:user.name,role:user.role}})
})

// ── Admin: user management ───────────────────────────────────────
app.get('/api/admin/users', auth, adminOnly, (req,res) => {
  const list=[...users.values()].map(u=>({userId:u.userId,username:u.username,name:u.name,role:u.role}))
  res.json({users:list})
})

app.post('/api/admin/users', auth, adminOnly, (req,res) => {
  const {username,password,name,role}=req.body||{}
  if(!username||!password) return res.status(400).json({error:'Username and password required'})
  if(users.has(username)) return res.status(409).json({error:'Username already exists'})
  const userId=`user_${Date.now()}`
  users.set(username,{userId,username,name:name||username,password,role:role||'user'})
  res.status(201).json({user:{userId,username,name:name||username,role:role||'user'}})
})

app.put('/api/admin/users/:userId', auth, adminOnly, (req,res) => {
  const user=[...users.values()].find(u=>u.userId===req.params.userId)
  if(!user) return res.status(404).json({error:'User not found'})
  const {role,name}=req.body||{}
  if(role) user.role=role
  if(name) user.name=name
  res.json({user:{userId:user.userId,username:user.username,name:user.name,role:user.role}})
})

app.post('/api/admin/users/:userId/reset-password', auth, adminOnly, (req,res) => {
  const user=[...users.values()].find(u=>u.userId===req.params.userId)
  if(!user) return res.status(404).json({error:'User not found'})
  const {newPassword}=req.body||{}
  if(!newPassword||newPassword.length<6) return res.status(400).json({error:'Password must be at least 6 characters'})
  user.password=newPassword
  res.json({ok:true})
})

// ── Games ────────────────────────────────────────────────────────
app.get('/api/games/search', async(req,res) => {
  const q=(req.query.q||'').trim(); if(!q)return res.json({games:[]})
  const ck=`search:${q.toLowerCase()}`; const cached=cacheGet(ck); if(cached)return res.json(cached)
  try{const games=await bggSearch(q);const result={games};cacheSet(ck,result);res.json(result)}
  catch(err){res.status(502).json({error:`Search failed: ${err.message}`})}
})

app.get('/api/games/:id', async(req,res) => {
  const id=req.params.id; const ck=`game:${id}`; const cached=cacheGet(ck); if(cached)return res.json(cached)
  try{const results=await bggThingBatch([id]);const game=results[0]||null;if(game)cacheSet(ck,game);res.json(game)}
  catch(err){res.status(502).json({error:'Game lookup failed'})}
})

// ── Library ──────────────────────────────────────────────────────
app.get('/api/library', auth, async(req,res) => {
  const store=getStore(req.user.userId)
  const need=store.library.filter(e=>!e.name||e.name==='Loading ...')
  if(need.length>0){try{const d=await bggThingBatch(need.map(e=>e.gameId));const dm=new Map(d.map(x=>[x.id,x]));need.forEach(e=>{const x=dm.get(e.gameId);if(x){e.name=x.name;e.image=x.image;e.thumbnail=x.thumbnail;e.yearPublished=x.yearPublished;e.minPlayers=x.minPlayers;e.maxPlayers=x.maxPlayers}})}catch{}}
  res.json({games:store.library})
})

app.post('/api/library', auth, (req,res) => {
  const {gameId,name,image,thumbnail,yearPublished,minPlayers,maxPlayers}=req.body||{}
  if(!gameId)return res.status(400).json({error:'gameId required'})
  const store=getStore(req.user.userId)
  if(store.library.find(e=>String(e.gameId)===String(gameId)))return res.status(409).json({error:'Already in library'})
  const entry={gameId:String(gameId),name,image,thumbnail,yearPublished,minPlayers:minPlayers||null,maxPlayers:maxPlayers||null,addedAt:new Date().toISOString(),plays:0}
  store.library.push(entry)
  res.status(201).json({entry})
})

// Update library game (custom image override)
app.put('/api/library/:gameId', auth, (req,res) => {
  const store=getStore(req.user.userId)
  const entry=store.library.find(e=>String(e.gameId)===String(req.params.gameId))
  if(!entry)return res.status(404).json({error:'Game not in library'})
  const {customImage,customThumbnail,name}=req.body||{}
  if(customImage) entry.image=customImage
  if(customThumbnail) entry.thumbnail=customThumbnail
  if(name) entry.name=name
  res.json({entry})
})

app.delete('/api/library/:gameId', auth, (req,res) => {
  const store=getStore(req.user.userId)
  store.library=store.library.filter(e=>String(e.gameId)!==String(req.params.gameId))
  res.status(204).end()
})

// ── Wishlist ─────────────────────────────────────────────────────
app.get('/api/wishlist', auth, async(req,res) => {
  const store=getStore(req.user.userId)
  const need=store.wishlist.filter(e=>!e.name||e.name==='Loading ...')
  if(need.length>0){try{const d=await bggThingBatch(need.map(e=>e.gameId));const dm=new Map(d.map(x=>[x.id,x]));need.forEach(e=>{const x=dm.get(e.gameId);if(x){e.name=x.name;e.image=x.image;e.thumbnail=x.thumbnail;e.yearPublished=x.yearPublished}})}catch{}}
  res.json({games:store.wishlist})
})

app.post('/api/wishlist', auth, (req,res) => {
  const {gameId,name,image,thumbnail,yearPublished}=req.body||{}
  if(!gameId)return res.status(400).json({error:'gameId required'})
  const store=getStore(req.user.userId)
  if(store.wishlist.find(e=>String(e.gameId)===String(gameId)))return res.status(409).json({error:'Already in wishlist'})
  store.wishlist.push({gameId:String(gameId),name,image,thumbnail,yearPublished,addedAt:new Date().toISOString()})
  res.status(201).json({ok:true})
})

app.delete('/api/wishlist/:gameId', auth, (req,res) => {
  const store=getStore(req.user.userId)
  store.wishlist=store.wishlist.filter(e=>String(e.gameId)!==String(req.params.gameId))
  res.status(204).end()
})

// ── Plays ────────────────────────────────────────────────────────
app.get('/api/plays', auth, (req,res) => { res.json({plays:getStore(req.user.userId).plays}) })

app.post('/api/plays', auth, (req,res) => {
  const {gameId,gameName,gameImage,players,playedAt,datePlayed,notes}=req.body||{}
  if(!gameId)return res.status(400).json({error:'gameId required'})
  const store=getStore(req.user.userId)
  const lib=store.library.find(e=>e.gameId===String(gameId))
  const play={id:`play_${Date.now()}`,gameId:String(gameId),gameName:gameName||lib?.name||null,gameImage:gameImage||lib?.thumbnail||lib?.image||null,players:players||[],playedAt:playedAt||datePlayed||new Date().toISOString(),datePlayed:datePlayed||playedAt||new Date().toISOString(),notes:notes||''}
  store.plays.unshift(play)
  if(lib)lib.plays=(lib.plays||0)+1
  res.status(201).json({play})
})

app.delete('/api/plays/:id', auth, (req,res) => {
  const store=getStore(req.user.userId)
  store.plays=store.plays.filter(p=>p.id!==req.params.id)
  res.status(204).end()
})

// ── Dashboard ────────────────────────────────────────────────────
app.get('/api/dashboard', auth, (req,res) => {
  const store=getStore(req.user.userId)
  const lib=store.library, mostPlayed=[...lib].sort((a,b)=>(b.plays||0)-(a.plays||0))[0]
  const library={totalGames:lib.length,totalPlays:lib.reduce((s,g)=>s+(g.plays||0),0),mostPlayedGame:mostPlayed&&mostPlayed.plays>0?{name:mostPlayed.name||mostPlayed.gameId,plays:mostPlayed.plays}:null}
  const wish=store.wishlist
  const wishlist={totalGames:wish.length,recentlyAdded:wish.slice(0,3).map(g=>({name:g.name||g.gameId}))}
  const pa=store.plays, uids=new Set(pa.map(p=>p.gameId)), gpc={}
  pa.forEach(p=>{gpc[p.gameId]=(gpc[p.gameId]||0)+1})
  const top=Object.entries(gpc).sort((a,b)=>b[1]-a[1])[0]
  const plays={uniqueGames:uids.size,totalSessions:pa.length,winRate:null,mostPlayedGame:top?{name:pa.find(p=>p.gameId===top[0])?.gameName||lib.find(e=>e.gameId===top[0])?.name||top[0],plays:top[1]}:null}
  res.json({library,wishlist,plays,league:{score:0,wins:0,losses:0,winPercentage:null,leaderboardPosition:null}})
})

// ── Leagues ──────────────────────────────────────────────────────
app.get('/api/leagues', auth, (req,res) => {
  const uid=req.user.userId
  res.json({leagues:[...leagues.values()].map(l=>({...l,memberCount:l.members.length,gamesPlayed:l.plays.length,isMember:l.members.some(m=>m.userId===uid),memberNames:l.members.map(m=>m.name||m.username)}))})
})

app.post('/api/leagues', auth, (req,res) => {
  const {name,description}=req.body||{}; if(!name)return res.status(400).json({error:'League name required'})
  const user=[...users.values()].find(u=>u.userId===req.user.userId)
  const id=`league_${Date.now()}`
  const league={id,name,description:description||'',createdBy:req.user.userId,members:[{userId:req.user.userId,username:user?.username||'Unknown',name:user?.name||'Unknown'}],plays:[],createdAt:new Date().toISOString()}
  leagues.set(id,league)
  res.status(201).json({league:{...league,memberCount:1,gamesPlayed:0,isMember:true}})
})

app.get('/api/leagues/:id', auth, (req,res) => {
  const l=leagues.get(req.params.id); if(!l)return res.status(404).json({error:'Not found'})
  res.json({league:{...l,memberCount:l.members.length,gamesPlayed:l.plays.length,isMember:l.members.some(m=>m.userId===req.user.userId)}})
})

app.post('/api/leagues/:id/join', auth, (req,res) => {
  const l=leagues.get(req.params.id); if(!l)return res.status(404).json({error:'Not found'})
  const user=[...users.values()].find(u=>u.userId===req.user.userId)
  if(!l.members.some(m=>m.userId===req.user.userId)) l.members.push({userId:req.user.userId,username:user?.username||'Unknown',name:user?.name||'Unknown'})
  res.json({ok:true})
})

app.delete('/api/leagues/:id/leave', auth, (req,res) => {
  const l=leagues.get(req.params.id); if(!l)return res.status(404).json({error:'Not found'})
  l.members=l.members.filter(m=>m.userId!==req.user.userId)
  res.json({ok:true})
})

// Add member to league by username
app.post('/api/leagues/:id/members', auth, (req,res) => {
  const l=leagues.get(req.params.id); if(!l)return res.status(404).json({error:'Not found'})
  const {username}=req.body||{}; if(!username)return res.status(400).json({error:'Username required'})
  const user=users.get(username); if(!user)return res.status(404).json({error:'User not found'})
  if(l.members.some(m=>m.userId===user.userId))return res.status(409).json({error:'Already a member'})
  l.members.push({userId:user.userId,username:user.username,name:user.name})
  res.json({ok:true,member:{userId:user.userId,username:user.username,name:user.name}})
})

app.post('/api/leagues/:id/plays', auth, (req,res) => {
  const l=leagues.get(req.params.id); if(!l)return res.status(404).json({error:'Not found'})
  if(!l.members.some(m=>m.userId===req.user.userId))return res.status(403).json({error:'Not a member'})
  const {gameId,gameName,players,datePlayed}=req.body||{}; if(!gameId)return res.status(400).json({error:'gameId required'})
  const play={id:`lp_${Date.now()}`,gameId:String(gameId),gameName:gameName||null,players:players||[],datePlayed:datePlayed||new Date().toISOString(),loggedBy:req.user.userId}
  l.plays.unshift(play)
  res.status(201).json({play})
})

app.get('/api/leagues/:id/leaderboard', auth, (req,res) => {
  const l=leagues.get(req.params.id); if(!l)return res.status(404).json({error:'Not found'})
  const ps=new Map()
  for(const play of l.plays){for(const p of(play.players||[])){const n=p.name||'Unknown';if(!ps.has(n))ps.set(n,{username:n,gamesPlayed:0,wins:0});const s=ps.get(n);s.gamesPlayed++;if(p.winner)s.wins++}}
  const lb=[...ps.values()].map(s=>({...s,winPercentage:s.gamesPlayed>0?Math.round(s.wins/s.gamesPlayed*100):0})).sort((a,b)=>b.wins-a.wins||b.winPercentage-a.winPercentage).map((s,i)=>({...s,rank:i+1}))
  res.json({leaderboard:lb})
})

app.get('/api/leagues/:id/plays', auth, (req,res) => {
  const l=leagues.get(req.params.id); if(!l)return res.status(404).json({error:'Not found'})
  res.json({plays:l.plays})
})

app.get('/api/leagues/:id/stats', auth, (req,res) => {
  const l=leagues.get(req.params.id); if(!l)return res.status(404).json({error:'Not found'})
  const gc={};l.plays.forEach(p=>{const n=p.gameName||p.gameId;gc[n]=(gc[n]||0)+1})
  res.json({totalPlays:l.plays.length,totalMembers:l.members.length,mostPlayed:Object.entries(gc).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count}))})
})

app.get('/api/health', (req,res) => res.json({status:'ok'}))

app.listen(PORT, () => {
  console.log(`🎲 Meeple API running at http://localhost:${PORT}`)
  if(BGG_APP_TOKEN) console.log('   App token: configured')
})
