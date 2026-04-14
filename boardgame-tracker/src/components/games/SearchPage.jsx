import React, { useState, useCallback, useRef, useEffect } from 'react'
import { gamesApi } from '../../api/games'
import { libraryApi } from '../../api/library'
import { wishlistApi } from '../../api/wishlist'
import { Spinner, EmptyState, ErrorState } from '../ui/primitives'
import { GameDetailModal } from './GameDetailModal'
import { Tooltip } from '../ui/Tooltip'
import { Search, BookOpen, Bookmark, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// BGG search returns id/name/year only — we lazy-load thumbnails per card
function useGameThumbnail(gameId) {
  const [thumb, setThumb] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    setLoading(true)
    setThumb(null)
    gamesApi.getById(gameId)
      .then(game => { if (!cancelled) { setThumb(game.image || game.thumbnail); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [gameId])

  return { thumb, loading }
}

function GameCard({ game, onSelect, onAddToLibrary, onAddToWishlist, inLibrary, inWishlist }) {
  const [libLoading, setLibLoading] = useState(false)
  const [wishLoading, setWishLoading] = useState(false)
  const { thumb, loading: thumbLoading } = useGameThumbnail(game.id)

  async function handleLib(e) {
    e.stopPropagation()
    if (inLibrary) return
    setLibLoading(true)
    try { await onAddToLibrary(game) } finally { setLibLoading(false) }
  }

  async function handleWish(e) {
    e.stopPropagation()
    if (inWishlist) return
    setWishLoading(true)
    try { await onAddToWishlist(game) } finally { setWishLoading(false) }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card group cursor-pointer hover:border-amber-400/30 transition-all duration-200 overflow-hidden flex flex-col"
      onClick={() => onSelect(game)}
    >
      {/* Thumbnail */}
      <div className="relative h-44 bg-[var(--bg-secondary)] overflow-hidden flex items-center justify-center">
        {thumbLoading ? (
          <Spinner size="md" />
        ) : thumb ? (
          <img src={thumb} alt={game.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <BookOpen className="w-8 h-8 text-[var(--text-muted)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        {game.yearPublished && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-white/80">
            <Calendar className="w-3 h-3" />{game.yearPublished}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-[var(--text-primary)] text-sm leading-snug line-clamp-2 flex-1 mb-3">
          {game.name}
        </h3>

        <div className="flex gap-2">
          <Tooltip content={inLibrary ? 'In library' : 'Add to library'}>
            <button
              onClick={handleLib}
              disabled={inLibrary || libLoading}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all
                ${inLibrary
                  ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:border-green-400 hover:text-green-700'
                }`}
            >
              {libLoading ? <Spinner size="sm" /> : inLibrary ? <CheckCircle2 className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
              {inLibrary ? 'Owned' : 'Library'}
            </button>
          </Tooltip>

          <Tooltip content={inWishlist ? 'In wishlist' : 'Add to wishlist'}>
            <button
              onClick={handleWish}
              disabled={inWishlist || wishLoading}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all
                ${inWishlist
                  ? 'bg-[var(--accent-dim)] border border-[rgba(193,127,58,0.3)] cursor-default'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
              style={inWishlist ? { color: 'var(--accent)' } : undefined}
            >
              {wishLoading ? <Spinner size="sm" /> : inWishlist ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              {inWishlist ? 'Saved' : 'Wishlist'}
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  )
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [library, setLibrary] = useState(new Set())
  const [wishlist, setWishlist] = useState(new Set())
  const searchTimeout = useRef(null)

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true); setError('')
    try {
      const data = await gamesApi.search(q)
      setResults(data?.games || data || [])
      setSearched(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => doSearch(val), 500)
  }

  async function handleAddToLibrary(game) {
    await libraryApi.add(game.id, { name: game.name, yearPublished: game.yearPublished })
    setLibrary(s => new Set([...s, game.id]))
  }

  async function handleAddToWishlist(game) {
    await wishlistApi.add(game.id, { name: game.name, yearPublished: game.yearPublished })
    setWishlist(s => new Set([...s, game.id]))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Discover Games</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Search the BoardGameGeek database of 150,000+ games.</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Search BoardGameGeek…"
          className="input-field pl-10 py-3 text-base"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner />
          </div>
        )}
      </div>

      {/* BGG attribution */}
      {searched && (
        <p className="text-xs text-[var(--text-muted)] -mt-2 flex items-center gap-1">
          Results from
          <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer"
             className="underline hover:text-[var(--text-secondary)] transition-colors">
            BoardGameGeek
          </a>
          · {results.length} found
          {results.length === 30 && ' (showing top 30)'}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Search failed</p>
            <p className="text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && searched && results.length === 0 && !error && (
        <EmptyState icon={Search} title="No games found" description={`No results for "${query}". Try a different search term.`} />
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {results.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onSelect={setSelectedGame}
              onAddToLibrary={handleAddToLibrary}
              onAddToWishlist={handleAddToWishlist}
              inLibrary={library.has(game.id)}
              inWishlist={wishlist.has(game.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-[var(--text-muted)]" />
          </div>
          <p className="font-display text-base font-semibold text-[var(--text-primary)] mb-1">Search the world's largest board game database</p>
          <p className="text-[var(--text-muted)] text-sm max-w-xs">Type a game name above to search BoardGameGeek's catalogue of over 150,000 games.</p>
        </div>
      )}

      {/* Game detail modal */}
      <GameDetailModal
        gameId={selectedGame?.id}
        open={!!selectedGame}
        onClose={() => setSelectedGame(null)}
        onAddToLibrary={handleAddToLibrary}
        onAddToWishlist={handleAddToWishlist}
      />
    </div>
  )
}
