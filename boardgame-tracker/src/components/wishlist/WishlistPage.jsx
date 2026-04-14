import React, { useState } from 'react'
import { wishlistApi } from '../../api/wishlist'
import { useApi } from '../../hooks/useApi'
import { Spinner, EmptyState, ErrorState, Skeleton } from '../ui/primitives'
import { Tooltip } from '../ui/Tooltip'
import { GameDetailModal } from '../games/GameDetailModal'
import { motion } from 'framer-motion'
import { Star, Trash2, Calendar, Search } from 'lucide-react'

function WishlistCard({ item, onRemove, onSelect, removing }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="card group cursor-pointer hover:border-amber-400/30 transition-all duration-200 overflow-hidden flex flex-col"
      onClick={() => onSelect(item)}
    >
      <div className="relative h-40 bg-[var(--bg-secondary)] overflow-hidden">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Star className="w-8 h-8 text-[var(--text-muted)]" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {item.yearPublished && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-white/70">
            <Calendar className="w-3 h-3" />{item.yearPublished}
          </div>
        )}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <Tooltip content="Remove from wishlist">
            <button
              onClick={() => onRemove(item.id)}
              disabled={removing}
              className="w-7 h-7 rounded-lg bg-red-900/80 border border-red-700/50 flex items-center justify-center text-red-300 hover:bg-red-700/80 transition-colors disabled:opacity-50"
            >
              {removing ? <Spinner size="sm" className="w-3 h-3" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-display font-semibold text-[var(--text-primary)] text-sm leading-snug line-clamp-2">{item.name}</h3>
        {item.addedAt && (
          <p className="text-xs text-[var(--text-muted)] mt-1">Added {new Date(item.addedAt).toLocaleDateString()}</p>
        )}
      </div>
    </motion.div>
  )
}

export function WishlistPage() {
  const { data, loading, error, refetch } = useApi(wishlistApi.getAll)
  const [removing, setRemoving] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [filter, setFilter] = useState('')

  async function handleRemove(gameId) {
    setRemoving(gameId)
    try {
      await wishlistApi.remove(gameId)
      await refetch()
    } catch (err) {
      console.error(err)
    } finally {
      setRemoving(null)
    }
  }

  const games = (data?.games || data || []).filter(g =>
    !filter || g.name?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Wishlist</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {data ? `${(data?.games || data || []).length} games wishlisted` : 'Games you want to play'}
        </p>
      </div>

      {!loading && games.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter wishlist…" className="input-field pl-9" />
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && games.length === 0 && (
        <EmptyState icon={Star} title={filter ? 'No matches' : 'Wishlist is empty'} description={filter ? `No games matching "${filter}"` : 'Find games you want and add them here.'} />
      )}
      {!loading && !error && games.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {games.map(item => (
            <WishlistCard key={item.id} item={item} onRemove={handleRemove} onSelect={setSelectedGame} removing={removing === item.id} />
          ))}
        </div>
      )}

      <GameDetailModal gameId={selectedGame?.id} open={!!selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  )
}
