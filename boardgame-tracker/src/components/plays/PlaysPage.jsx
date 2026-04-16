import React, { useState } from 'react'
import { playsApi } from '../../api/plays'
import { libraryApi } from '../../api/library'
import { authApi } from '../../api/auth'
import { useApi } from '../../hooks/useApi'
import { Button, Input, Select, Spinner, EmptyState, ErrorState, Skeleton, Badge } from '../ui/primitives'
import { Modal } from '../ui/Modal'
import { Tooltip } from '../ui/Tooltip'
import { motion } from 'framer-motion'
import {
  ClipboardList, Plus, Trash2, Crown, Calendar,
  Users, Filter, X
} from 'lucide-react'

function PlayRow({ play, onDelete, deleting }) {
  const date = play.datePlayed ? new Date(play.datePlayed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 flex items-start gap-4"
    >
      {play.gameImage && (
        <img src={play.gameImage} alt={play.gameName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h3 className="font-display font-semibold text-[var(--text-primary)] text-sm">{play.gameName}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>
              {play.players?.length > 0 && (
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{play.players.length} players</span>
              )}
            </div>
          </div>
          <Tooltip content="Delete play">
            <button
              onClick={() => onDelete(play.id)}
              disabled={deleting}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/20 transition-colors"
            >
              {deleting ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>
        </div>

        {/* Players + scores */}
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
    </motion.div>
  )
}

function LogPlayModal({ open, onClose, onLogged, library }) {
  const { data: usersData } = useApi(() => authApi.getUsers().catch(() => ({ users: [] })))
  const [form, setForm] = useState({
    gameId: '',
    datePlayed: new Date().toISOString().split('T')[0],
    players: [{ name: '', score: '', winner: false }],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const knownUsers = (usersData?.users || []).map(u => u.name || u.username)

  function addPlayer() {
    setForm(f => ({ ...f, players: [...f.players, { name: '', score: '', winner: false }] }))
  }

  function removePlayer(i) {
    setForm(f => ({ ...f, players: f.players.filter((_, j) => j !== i) }))
  }

  function updatePlayer(i, field, value) {
    setForm(f => ({
      ...f,
      players: f.players.map((p, j) => {
        if (j !== i) return { ...p, ...(field === 'winner' && value ? { winner: false } : {}) }
        return { ...p, [field]: value }
      }),
    }))
  }

  async function handleSubmit() {
    if (!form.gameId) { setError('Please select a game.'); return }
    setLoading(true); setError('')
    try {
      const games = library?.games || library || []
      const selectedGame = games.find(g => (g.gameId || g.id) === form.gameId)
      const payload = {
        gameId: form.gameId,
        gameName: selectedGame?.name || null,
        gameImage: selectedGame?.thumbnail || selectedGame?.image || null,
        datePlayed: form.datePlayed,
        players: form.players.filter(p => p.name.trim()).map(p => ({
          name: p.name.trim(),
          score: p.score !== '' ? Number(p.score) : null,
          winner: p.winner,
        })),
      }
      await playsApi.logPlay(payload)
      onLogged()
      onClose()
      setForm({ gameId: '', datePlayed: new Date().toISOString().split('T')[0], players: [{ name: '', score: '', winner: false }] })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const [gameSearch, setGameSearch] = useState('')

  const allLibraryGames = library?.games || library || []
  const filteredGames = gameSearch
    ? allLibraryGames.filter(g => g.name?.toLowerCase().includes(gameSearch.toLowerCase()))
    : allLibraryGames

  function selectGame(g) {
    setForm(f => ({ ...f, gameId: g.gameId || g.id }))
    setGameSearch(g.name)
  }

  return (
    <Modal open={open} onClose={onClose} title="Log a Play" size="md">
      <div className="p-6 space-y-5">
        {error && <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm">{error}</div>}

        {/* Searchable game picker */}
        <div className="relative">
          <label className="label">Game</label>
          <input
            type="text"
            value={gameSearch}
            onChange={e => { setGameSearch(e.target.value); setForm(f => ({ ...f, gameId: '' })) }}
            placeholder="Type to search your library…"
            className="input-field w-full"
          />
          {gameSearch && !form.gameId && filteredGames.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-lg">
              {filteredGames.map(g => (
                <button
                  key={g.gameId || g.id}
                  type="button"
                  onClick={() => selectGame(g)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  {g.thumbnail && <img src={g.thumbnail} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{g.name}</div>
                    {g.yearPublished && <div className="text-[10px] text-[var(--text-muted)]">{g.yearPublished}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {form.gameId && (
            <div className="mt-1 text-xs text-green-600 flex items-center gap-1">✓ {gameSearch}</div>
          )}
        </div>

        <Input label="Date played" type="date" value={form.datePlayed} onChange={e => setForm(f => ({ ...f, datePlayed: e.target.value }))} />

        {/* Players */}
        <div>
          <div className="label">Players</div>
          <div className="space-y-2">
            {form.players.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  list="player-suggestions"
                  placeholder={`Player ${i + 1}`}
                  value={p.name}
                  onChange={e => updatePlayer(i, 'name', e.target.value)}
                  className="input-field flex-1"
                />
                <input
                  type="number"
                  placeholder="Score"
                  value={p.score}
                  onChange={e => updatePlayer(i, 'score', e.target.value)}
                  className="input-field w-20"
                />
                <Tooltip content="Mark as winner">
                  <button
                    type="button"
                    onClick={() => updatePlayer(i, 'winner', !p.winner)}
                    className={`p-2 rounded-lg border transition-colors ${p.winner ? 'bg-amber-400/15 border-amber-400/40 text-amber-400' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-amber-400'}`}
                  >
                    <Crown className="w-4 h-4" />
                  </button>
                </Tooltip>
                {form.players.length > 1 && (
                  <button type="button" onClick={() => removePlayer(i)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addPlayer} className="mt-2 text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors">
            <Plus className="w-3.5 h-3.5" />Add player
          </button>
          <datalist id="player-suggestions">
            {knownUsers.map(name => <option key={name} value={name} />)}
          </datalist>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? 'Saving…' : 'Log Play'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function PlaysPage() {
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', players: '', gameId: '' })
  const [appliedFilters, setAppliedFilters] = useState({})
  const [logOpen, setLogOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const { data: plays, loading, error, refetch } = useApi(() => playsApi.getAll(appliedFilters), [JSON.stringify(appliedFilters)])
  const { data: library } = useApi(libraryApi.getAll)

  async function handleDelete(id) {
    setDeleting(id)
    try { await playsApi.deletePlay(id); await refetch() } catch (e) { console.error(e) } finally { setDeleting(null) }
  }

  function applyFilters() {
    setAppliedFilters({ ...filters })
  }

  function clearFilters() {
    const empty = { dateFrom: '', dateTo: '', players: '', gameId: '' }
    setFilters(empty)
    setAppliedFilters(empty)
  }

  const hasActiveFilters = Object.values(appliedFilters).some(Boolean)
  const playList = plays?.plays || plays || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Play Log</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{playList.length > 0 ? `${playList.length} recorded ${playList.length === 1 ? 'session' : 'sessions'}` : 'Track every game you play'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowFilters(f => !f)}>
            <Filter className="w-3.5 h-3.5" />
            Filters {hasActiveFilters && <Badge variant="amber" className="ml-1 py-0 px-1.5">on</Badge>}
          </Button>
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <Plus className="w-3.5 h-3.5" />Log Play
          </Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <motion.div
          className="card p-4"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Input label="From date" type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
            <Input label="To date" type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
            <Input label="Player name" type="text" placeholder="Filter by player" value={filters.players} onChange={e => setFilters(f => ({ ...f, players: e.target.value }))} />
            <Select label="Game" value={filters.gameId} onChange={e => setFilters(f => ({ ...f, gameId: e.target.value }))}>
              <option value="">All games</option>
              {(library?.games || library || []).map(g => <option key={g.gameId || g.id} value={g.gameId || g.id}>{g.name}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilters}>Apply Filters</Button>
            {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>}
          </div>
        </motion.div>
      )}

      {loading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && playList.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No plays logged"
          description={hasActiveFilters ? 'No plays match your filters.' : 'Start logging your board game sessions!'}
          action={!hasActiveFilters && <Button size="sm" onClick={() => setLogOpen(true)}><Plus className="w-3.5 h-3.5" />Log your first play</Button>}
        />
      )}
      {!loading && !error && playList.length > 0 && (
        <div className="space-y-3">
          {playList.map(play => (
            <PlayRow key={play.id} play={play} onDelete={handleDelete} deleting={deleting === play.id} />
          ))}
        </div>
      )}

      <LogPlayModal open={logOpen} onClose={() => setLogOpen(false)} onLogged={refetch} library={library} />
    </div>
  )
}
