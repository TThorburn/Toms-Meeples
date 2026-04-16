import React, { useState } from 'react'
import { leaguesApi } from '../../api/leagues'
import { libraryApi } from '../../api/library'
import { useApi } from '../../hooks/useApi'
import { Button, Input, Spinner, EmptyState, ErrorState, Skeleton, Badge } from '../ui/primitives'
import { Modal } from '../ui/Modal'
import { Tooltip } from '../ui/Tooltip'
import { motion } from 'framer-motion'
import {
  Trophy, Users, Crown, Medal, LogIn, LogOut, BarChart3,
  Plus, ArrowLeft, Calendar, Gamepad2, X, UserPlus
} from 'lucide-react'

// ── League Card ──────────────────────────────────────────────────
function LeagueCard({ league, onJoin, onLeave, onView, joining }) {
  const isMember = league.isMember
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-[var(--text-primary)]">{league.name}</h3>
            {league.description && <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{league.description}</p>}
          </div>
        </div>
        {isMember && <Badge variant="amber">Member</Badge>}
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{league.memberCount} members</span>
        <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{league.gamesPlayed} games played</span>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onView(league)} className="flex-1">View League</Button>
        {isMember ? (
          <Button variant="danger" size="sm" onClick={() => onLeave(league.id)} disabled={joining === league.id}>
            {joining === league.id ? <Spinner size="sm" /> : <LogOut className="w-3.5 h-3.5" />}
          </Button>
        ) : (
          <Button size="sm" onClick={() => onJoin(league.id)} disabled={joining === league.id}>
            {joining === league.id ? <Spinner size="sm" /> : <LogIn className="w-3.5 h-3.5" />} Join
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ── Create League Modal ──────────────────────────────────────────
function CreateLeagueModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('League name required'); return }
    setLoading(true); setError('')
    try {
      await leaguesApi.create({ name: name.trim(), description: description.trim() })
      onCreated()
      onClose()
      setName(''); setDescription('')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create League" size="sm">
      <div className="p-6 space-y-4">
        {error && <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm">{error}</div>}
        <Input label="League Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Friday Night Games" autoFocus />
        <div>
          <label className="label">Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this league about?" className="input-field w-full h-20 resize-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleCreate} disabled={loading} className="flex-1">{loading ? 'Creating…' : 'Create League'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Log League Play Modal ────────────────────────────────────────
function LogLeaguePlayModal({ open, onClose, onLogged, leagueId }) {
  const { data: library } = useApi(libraryApi.getAll)
  const [form, setForm] = useState({ gameId: '', gameName: '', datePlayed: new Date().toISOString().split('T')[0], players: [{ name: '', score: '', winner: false }] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addPlayer() { setForm(f => ({ ...f, players: [...f.players, { name: '', score: '', winner: false }] })) }
  function removePlayer(i) { setForm(f => ({ ...f, players: f.players.filter((_, j) => j !== i) })) }
  function updatePlayer(i, field, value) {
    setForm(f => ({ ...f, players: f.players.map((p, j) => {
      if (j !== i) return { ...p, ...(field === 'winner' && value ? { winner: false } : {}) }
      return { ...p, [field]: value }
    }) }))
  }

  function handleGameSelect(e) {
    const gameId = e.target.value
    const games = library?.games || []
    const game = games.find(g => g.gameId === gameId)
    setForm(f => ({ ...f, gameId, gameName: game?.name || '' }))
  }

  async function handleSubmit() {
    if (!form.gameId) { setError('Please select a game'); return }
    setLoading(true); setError('')
    try {
      await leaguesApi.logPlay(leagueId, {
        gameId: form.gameId, gameName: form.gameName, datePlayed: form.datePlayed,
        players: form.players.filter(p => p.name.trim()).map(p => ({ name: p.name.trim(), score: p.score !== '' ? Number(p.score) : null, winner: p.winner })),
      })
      onLogged()
      onClose()
      setForm({ gameId: '', gameName: '', datePlayed: new Date().toISOString().split('T')[0], players: [{ name: '', score: '', winner: false }] })
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const games = library?.games || []

  return (
    <Modal open={open} onClose={onClose} title="Log League Play" size="md">
      <div className="p-6 space-y-5">
        {error && <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm">{error}</div>}
        <div>
          <label className="label">Game</label>
          <select value={form.gameId} onChange={handleGameSelect} className="input-field w-full">
            <option value="">Select a game…</option>
            {games.map(g => <option key={g.gameId} value={g.gameId}>{g.name}</option>)}
          </select>
        </div>
        <Input label="Date played" type="date" value={form.datePlayed} onChange={e => setForm(f => ({ ...f, datePlayed: e.target.value }))} />
        <div>
          <div className="label">Players</div>
          <div className="space-y-2">
            {form.players.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" placeholder={`Player ${i + 1}`} value={p.name} onChange={e => updatePlayer(i, 'name', e.target.value)} className="input-field flex-1" />
                <input type="number" placeholder="Score" value={p.score} onChange={e => updatePlayer(i, 'score', e.target.value)} className="input-field w-20" />
                <Tooltip content="Mark as winner">
                  <button type="button" onClick={() => updatePlayer(i, 'winner', !p.winner)}
                    className={`p-2 rounded-lg border transition-colors ${p.winner ? 'bg-amber-400/15 border-amber-400/40 text-amber-400' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-amber-400'}`}>
                    <Crown className="w-4 h-4" />
                  </button>
                </Tooltip>
                {form.players.length > 1 && <button type="button" onClick={() => removePlayer(i)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400"><X className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
          <button type="button" onClick={addPlayer} className="mt-2 text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add player</button>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">{loading ? 'Saving…' : 'Log Play'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── League Detail View ───────────────────────────────────────────
function LeagueDetailView({ league, onBack }) {
  const { data: lbData, loading: lbLoading, refetch: lbRefetch } = useApi(() => leaguesApi.getLeaderboard(league.id), [league.id])
  const { data: playsData, loading: playsLoading, refetch: playsRefetch } = useApi(() => leaguesApi.getPlays(league.id), [league.id])
  const { data: statsData, refetch: statsRefetch } = useApi(() => leaguesApi.getStats(league.id), [league.id])
  const { data: leagueData, refetch: leagueRefetch } = useApi(() => leaguesApi.getById(league.id), [league.id])
  const [logOpen, setLogOpen] = useState(false)
  const [tab, setTab] = useState('leaderboard')
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  const leaderboard = lbData?.leaderboard || []
  const plays = playsData?.plays || []
  const stats = statsData || {}
  const currentLeague = leagueData?.league || league
  const members = currentLeague.members || league.memberNames?.map(n => ({ name: n })) || []

  function handleLogged() { lbRefetch(); playsRefetch(); statsRefetch() }

  async function handleAddMember() {
    if (!addUsername.trim()) return
    setAddError(''); setAddSuccess('')
    try {
      await leaguesApi.addMember(league.id, addUsername.trim())
      setAddSuccess(`${addUsername} added!`)
      setAddUsername('')
      leagueRefetch()
      setTimeout(() => setAddSuccess(''), 2000)
    } catch (err) { setAddError(err.message) }
  }

  function rankIcon(pos) {
    if (pos === 1) return <Crown className="w-4 h-4 text-amber-400" />
    if (pos === 2) return <Medal className="w-4 h-4 text-slate-400" />
    if (pos === 3) return <Medal className="w-4 h-4 text-amber-700" />
    return <span className="text-xs font-mono text-[var(--text-muted)] w-4 text-center">{pos}</span>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="mt-1 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{league.name}</h1>
          {league.description && <p className="text-sm text-[var(--text-muted)] mt-1">{league.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{currentLeague.memberCount || members.length} members</span>
            <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{currentLeague.gamesPlayed || plays.length} games played</span>
          </div>
        </div>
        {(league.isMember || currentLeague.isMember) && (
          <Button size="sm" onClick={() => setLogOpen(true)}><Plus className="w-3.5 h-3.5" />Log Play</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border-subtle)]">
        {[
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          { id: 'members', label: 'Members', icon: Users },
          { id: 'plays', label: 'History', icon: Calendar },
          { id: 'stats', label: 'Stats', icon: BarChart3 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
          {lbLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
          {!lbLoading && leaderboard.length === 0 && <EmptyState icon={Trophy} title="No entries yet" description="Log a play to start the leaderboard!" />}
          {!lbLoading && leaderboard.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wider px-3 pb-1">
                <span>#</span><span>Player</span><span className="text-right">Games</span><span className="text-right">Wins</span><span className="text-right">Win%</span>
              </div>
              {leaderboard.map((entry, i) => (
                <div key={entry.username} className={`grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 items-center px-3 py-3 rounded-lg ${i === 0 ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-[var(--bg-raised)] border border-[var(--border-subtle)]'}`}>
                  <div className="flex items-center justify-center">{rankIcon(entry.rank ?? i + 1)}</div>
                  <div className="font-medium text-sm text-[var(--text-primary)] truncate">{entry.username}</div>
                  <div className="text-right text-sm text-[var(--text-secondary)]">{entry.gamesPlayed}</div>
                  <div className="text-right text-sm text-[var(--text-secondary)]">{entry.wins}</div>
                  <div className="text-right text-sm font-medium text-amber-400">{entry.winPercentage}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-4">
          {/* Add member */}
          <div className="card p-4">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Add Member by Username</div>
            {addError && <div className="text-xs text-red-400 mb-2">{addError}</div>}
            {addSuccess && <div className="text-xs text-green-400 mb-2">{addSuccess}</div>}
            <div className="flex gap-2">
              <input value={addUsername} onChange={e => setAddUsername(e.target.value)} placeholder="Enter username" className="input-field flex-1"
                onKeyDown={e => { if (e.key === 'Enter') handleAddMember() }} />
              <Button size="sm" onClick={handleAddMember}><UserPlus className="w-3.5 h-3.5" />Add</Button>
            </div>
          </div>
          {/* Member list */}
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={m.userId || i} className="card p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-amber-400">{(m.name || m.username || '?')[0].toUpperCase()}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{m.name || m.username}</div>
                  {m.username && <div className="text-[10px] text-[var(--text-muted)]">@{m.username}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Play History Tab */}
      {tab === 'plays' && (
        <div>
          {playsLoading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>}
          {!playsLoading && plays.length === 0 && <EmptyState icon={Calendar} title="No plays yet" description="Log your first game in this league!" />}
          {!playsLoading && plays.length > 0 && (
            <div className="space-y-3">
              {plays.map(play => (
                <div key={play.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-semibold text-sm text-[var(--text-primary)]">{play.gameName || play.gameId}</h3>
                      <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />{new Date(play.datePlayed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  {play.players?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {play.players.map((p, i) => (
                        <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border ${p.winner ? 'bg-amber-400/10 border-amber-400/30 text-amber-400' : 'bg-[var(--bg-raised)] border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>
                          {p.winner && <Crown className="w-3 h-3" />}
                          <span className="font-medium">{p.name}</span>
                          {p.score != null && <span className="text-[var(--text-muted)]">· {p.score}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 text-center">
              <div className="text-2xl font-display font-bold text-[var(--text-primary)]">{stats.totalPlays || 0}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Total Games Played</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-display font-bold text-[var(--text-primary)]">{stats.totalMembers || 0}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Members</div>
            </div>
          </div>
          {stats.mostPlayed?.length > 0 && (
            <div>
              <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Most Played Games</h3>
              <div className="space-y-2">
                {stats.mostPlayed.map((g, i) => (
                  <div key={g.name} className="card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[var(--text-muted)] w-5">{i + 1}.</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{g.name}</span>
                    </div>
                    <Badge variant="default">{g.count} plays</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <LogLeaguePlayModal open={logOpen} onClose={() => setLogOpen(false)} onLogged={handleLogged} leagueId={league.id} />
    </div>
  )
}

// ── Main Leagues Page ────────────────────────────────────────────
export function LeaguesPage() {
  const { data, loading, error, refetch } = useApi(leaguesApi.getAll)
  const [joining, setJoining] = useState(null)
  const [viewLeague, setViewLeague] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)

  async function handleJoin(id) {
    setJoining(id)
    try { await leaguesApi.join(id); await refetch() } catch (e) { console.error(e) } finally { setJoining(null) }
  }

  async function handleLeave(id) {
    setJoining(id)
    try { await leaguesApi.leave(id); await refetch() } catch (e) { console.error(e) } finally { setJoining(null) }
  }

  const leagues = data?.leagues || []

  // If viewing a league, show the detail view
  if (viewLeague) {
    return <LeagueDetailView league={viewLeague} onBack={() => { setViewLeague(null); refetch() }} />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Leagues</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Compete with friends and track your rankings.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" />Create League
        </Button>
      </div>

      {loading && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && leagues.length === 0 && (
        <EmptyState icon={Trophy} title="No leagues yet" description="Create your first league to start competing with friends!" action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5" />Create League</Button>} />
      )}
      {!loading && !error && leagues.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leagues.map(league => (
            <LeagueCard key={league.id} league={league} onJoin={handleJoin} onLeave={handleLeave} onView={setViewLeague} joining={joining} />
          ))}
        </div>
      )}

      <CreateLeagueModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} />
    </div>
  )
}
