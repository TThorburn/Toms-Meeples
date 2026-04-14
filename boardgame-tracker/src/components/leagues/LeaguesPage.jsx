import React, { useState } from 'react'
import { leaguesApi } from '../../api/leagues'
import { useApi } from '../../hooks/useApi'
import { Button, Spinner, EmptyState, ErrorState, Skeleton, Badge } from '../ui/primitives'
import { Modal } from '../ui/Modal'
import { motion } from 'framer-motion'
import { Trophy, Users, Crown, Medal, TrendingUp, LogIn, LogOut, BarChart3 } from 'lucide-react'

function LeagueCard({ league, onJoin, onLeave, onView, joining }) {
  const isMember = league.isMember
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-[var(--text-primary)]">{league.name}</h3>
            {league.description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{league.description}</p>
            )}
          </div>
        </div>
        {isMember && <Badge variant="amber">Member</Badge>}
      </div>

      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        {league.memberCount != null && (
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{league.memberCount} members</span>
        )}
        {league.gamesPlayed != null && (
          <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{league.gamesPlayed} games played</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onView(league)} className="flex-1">
          View Leaderboard
        </Button>
        {isMember ? (
          <Button variant="danger" size="sm" onClick={() => onLeave(league.id)} disabled={joining === league.id}>
            {joining === league.id ? <Spinner size="sm" /> : <LogOut className="w-3.5 h-3.5" />}
          </Button>
        ) : (
          <Button size="sm" onClick={() => onJoin(league.id)} disabled={joining === league.id}>
            {joining === league.id ? <Spinner size="sm" /> : <LogIn className="w-3.5 h-3.5" />}
            Join
          </Button>
        )}
      </div>
    </motion.div>
  )
}

function LeaderboardModal({ league, open, onClose }) {
  const { data, loading, error } = useApi(
    () => leaguesApi.getLeaderboard(league?.id),
    [league?.id],
    { immediate: !!league?.id && open }
  )

  const entries = data?.leaderboard || data || []

  function rankIcon(pos) {
    if (pos === 1) return <Crown className="w-4 h-4 text-amber-400" />
    if (pos === 2) return <Medal className="w-4 h-4 text-slate-400" />
    if (pos === 3) return <Medal className="w-4 h-4 text-amber-700" />
    return <span className="text-xs font-mono text-[var(--text-muted)] w-4 text-center">{pos}</span>
  }

  return (
    <Modal open={open} onClose={onClose} title={league?.name ? `${league.name} — Leaderboard` : 'Leaderboard'} size="md">
      <div className="p-6">
        {loading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
        {error && <ErrorState message={error} />}
        {!loading && !error && entries.length === 0 && (
          <EmptyState icon={Trophy} title="No entries yet" description="Be the first to log a play in this league!" />
        )}
        {!loading && !error && entries.length > 0 && (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wider px-3 pb-1">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Games</span>
              <span className="text-right">Wins</span>
              <span className="text-right">Win%</span>
            </div>
            {entries.map((entry, i) => (
              <div key={entry.userId || i} className={`grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 items-center px-3 py-3 rounded-lg ${i === 0 ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-[var(--bg-raised)] border border-[var(--border-subtle)]'}`}>
                <div className="flex items-center justify-center">
                  {rankIcon(entry.rank ?? i + 1)}
                </div>
                <div className="font-medium text-sm text-[var(--text-primary)] truncate">{entry.username}</div>
                <div className="text-right text-sm text-[var(--text-secondary)]">{entry.gamesPlayed ?? 0}</div>
                <div className="text-right text-sm text-[var(--text-secondary)]">{entry.wins ?? 0}</div>
                <div className="text-right text-sm font-medium text-amber-400">{entry.winPercentage != null ? `${entry.winPercentage}%` : '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function LeaguesPage() {
  const { data, loading, error, refetch } = useApi(leaguesApi.getAll)
  const [joining, setJoining] = useState(null)
  const [viewLeague, setViewLeague] = useState(null)

  async function handleJoin(id) {
    setJoining(id)
    try { await leaguesApi.join(id); await refetch() } catch (e) { console.error(e) } finally { setJoining(null) }
  }

  async function handleLeave(id) {
    setJoining(id)
    try { await leaguesApi.leave(id); await refetch() } catch (e) { console.error(e) } finally { setJoining(null) }
  }

  const leagues = data?.leagues || data || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Leagues</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Compete with friends and track your rankings.</p>
      </div>

      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && leagues.length === 0 && (
        <EmptyState icon={Trophy} title="No leagues available" description="There are no leagues to join yet." />
      )}
      {!loading && !error && leagues.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leagues.map(league => (
            <LeagueCard
              key={league.id}
              league={league}
              onJoin={handleJoin}
              onLeave={handleLeave}
              onView={setViewLeague}
              joining={joining === league.id ? league.id : null}
            />
          ))}
        </div>
      )}

      <LeaderboardModal league={viewLeague} open={!!viewLeague} onClose={() => setViewLeague(null)} />
    </div>
  )
}
