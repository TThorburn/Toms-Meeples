import React from 'react'
import { dashboardApi } from '../../api/dashboard'
import { useApi } from '../../hooks/useApi'
import { Skeleton, ErrorState } from '../ui/primitives'
import { motion } from 'framer-motion'
import {
  BookOpen, Star, ClipboardList, Trophy,
  TrendingUp, Gamepad2, Users, Target,
  Crown, Swords, BarChart3, Percent
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, accent = false, delay = 0 }) {
  return (
    <motion.div
      className={`card p-5 ${accent ? 'border-amber-400/25 bg-amber-400/5' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-amber-400/20' : 'bg-[var(--bg-raised)]'}`}>
          <Icon className={`w-4 h-4 ${accent ? 'text-amber-400' : 'text-[var(--text-secondary)]'}`} />
        </div>
      </div>
      <div className={`font-display text-2xl font-bold mb-0.5 ${accent ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>
        {value ?? '—'}
      </div>
      <div className="text-xs font-medium text-[var(--text-secondary)]">{label}</div>
      {sub && <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{sub}</div>}
    </motion.div>
  )
}

function SectionHeader({ icon: Icon, title, color = 'text-[var(--text-secondary)]' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{title}</h2>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-8 w-48 skeleton rounded" />
      {[0,1,2,3].map(i => (
        <div key={i}>
          <div className="h-4 w-24 skeleton rounded mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[0,1,2].map(j => <div key={j} className="h-28 skeleton rounded-xl" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const { data, loading, error, refetch } = useApi(dashboardApi.getStats)

  if (loading) return <DashboardSkeleton />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const d = data || {}
  const lib = d.library || {}
  const wish = d.wishlist || {}
  const plays = d.plays || {}
  const league = d.league || {}

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Your board game activity at a glance.</p>
      </div>

      {/* Library stats */}
      <section>
        <SectionHeader icon={BookOpen} title="Library" color="text-blue-400" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={BookOpen} label="Games in Library" value={lib.totalGames} delay={0.05} />
          <StatCard icon={TrendingUp} label="Total Plays" value={lib.totalPlays} delay={0.1} />
          <StatCard icon={Gamepad2} label="Most Played" value={lib.mostPlayedGame?.name} sub={`${lib.mostPlayedGame?.plays ?? 0} plays`} accent delay={0.15} />
        </div>
      </section>

      {/* Wishlist stats */}
      <section>
        <SectionHeader icon={Star} title="Wishlist" color="text-yellow-400" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={Star} label="Wishlisted Games" value={wish.totalGames} delay={0.05} />
          <StatCard icon={BookOpen} label="Recently Added" value={wish.recentlyAdded?.[0]?.name ?? '—'} sub={wish.recentlyAdded?.[1]?.name} delay={0.1} />
        </div>
      </section>

      {/* Play stats */}
      <section>
        <SectionHeader icon={ClipboardList} title="Play Log" color="text-green-400" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard icon={Gamepad2} label="Unique Games" value={plays.uniqueGames} delay={0.05} />
          <StatCard icon={ClipboardList} label="Total Sessions" value={plays.totalSessions} delay={0.1} />
          <StatCard icon={Target} label="Win Rate" value={plays.winRate != null ? `${plays.winRate}%` : '—'} delay={0.15} accent />
          <StatCard icon={Crown} label="Most Played" value={plays.mostPlayedGame?.name} sub={`${plays.mostPlayedGame?.plays ?? 0} sessions`} delay={0.2} />
        </div>
      </section>

      {/* League stats */}
      <section>
        <SectionHeader icon={Trophy} title="League" color="text-amber-400" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard icon={BarChart3} label="League Score" value={league.score} accent delay={0.05} />
          <StatCard icon={Swords} label="Wins / Losses" value={league.wins != null ? `${league.wins} / ${league.losses}` : '—'} delay={0.1} />
          <StatCard icon={Percent} label="Win %" value={league.winPercentage != null ? `${league.winPercentage}%` : '—'} delay={0.15} />
          <StatCard icon={Users} label="Leaderboard Rank" value={league.leaderboardPosition != null ? `#${league.leaderboardPosition}` : '—'} delay={0.2} />
        </div>
      </section>
    </div>
  )
}
