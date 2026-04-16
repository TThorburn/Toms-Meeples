import React, { useState, useCallback, useRef, useEffect } from 'react'
import { gamesApi } from '../../api/games'
import { libraryApi } from '../../api/library'
import { wishlistApi } from '../../api/wishlist'
import { Spinner, EmptyState, ErrorState } from '../ui/primitives'
import { GameDetailModal } from './GameDetailModal'
import { Tooltip } from '../ui/Tooltip'
import { Search, BookOpen, Bookmark, Calendar, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

const PAGE_SIZE = 20

function GameCard({ game, onSelect, onAddToLibrary, onAddToWishlist, inLibrary, inWishlist }) {
  const [libLoading, setLibLoading] = useState(false)
  const [wishLoading, setWishLoading] = useState(false)

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
      {/* Thumbnail — uses image from search results, no extra API call */}
      <div className="relative h-44 bg-[var(--bg-secondary)] overflow-hidden flex items-center justify-center">
        {game.thumbnail ? (
          <img
            src={game.thumbnail}
            alt={game.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <BookOpen className="w-8 h-8 text-[var(--text-muted)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        {game.yearPublished && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-white/80">
            <Calendar className="w-3 h-3" />{game.yearPublished}
          </div>
        )}
        {game.bggRating && (
          <div className="absolute bottom-2 right-2 text-xs text-white/80 font-medium">
            ★ {game.bggRating.toFixed(1)}
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
  const [page, setPage] = useState(0)
  const searchAbort = useRef(null)

  // Load existing library & wishlist so "Owned"/"Saved" badges persist
  const loadUserCollections = useCallback(() => {
    libraryApi.getAll().then(data => {
      const ids = (data?.games || []).map(g => String(g.gameId || g.id))
      if (ids.length > 0) setLibrary(new Set(ids))
    }).catch(() => {})
    wishlistApi.getAll().then(data => {
      const ids = (data?.games || []).map(g => String(g.gameId || g.id))
      if (ids.length > 0) setWishlist(new Set(ids))
    }).catch(() => {})
  }, [])

  useEffect(() => { loadUserCollections() }, [loadUserCollections])

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }

    // Cancel any in-flight search
    if (searchAbort.current) searchAbort.current.abort()
    const controller = new AbortController()
    searchAbort.current = controller

    setLoading(true)
    setError('')
    setPage(0)
    try {
      const data = await gamesApi.search(q)
      if (controller.signal.aborted) return
      setResults(data?.games || data || [])
      setSearched(true)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err.message)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      doSearch(query)
    }
  }

  function handleSelect(game) {
    setSelectedGame(game)
  }

  async function handleAddToLibrary(game) {
    await libraryApi.add(game.id, {
      name: game.name,
      yearPublished: game.yearPublished,
      image: game.image || game.thumbnail,
      thumbnail: game.thumbnail,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
    })
    setLibrary(s => new Set([...s, game.id]))
  }

  async function handleAddToWishlist(game) {
    await wishlistApi.add(game.id, {
      name: game.name,
      yearPublished: game.yearPublished,
      image: game.image || game.thumbnail,
      thumbnail: game.thumbnail,
    })
    setWishlist(s => new Set([...s, game.id]))
  }

  // Pagination
  const totalPages = Math.ceil(results.length / PAGE_SIZE)
  const pagedResults = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Discover Games</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Search the BoardGameGeek database of 150,000+ games.</p>
      </div>

      {/* Search input — searches on Enter only */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search BoardGameGeek… (press Enter)"
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
      {searched && !loading && (
        <p className="text-xs text-[var(--text-muted)] -mt-2 flex items-center gap-1">
          Results from
          <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer"
             className="underline hover:text-[var(--text-secondary)] transition-colors">
            BoardGameGeek
          </a>
          · {results.length} found
          {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
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

      {/* Results grid — only shows current page */}
      {pagedResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {pagedResults.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onSelect={handleSelect}
              onAddToLibrary={handleAddToLibrary}
              onAddToWishlist={handleAddToWishlist}
              inLibrary={library.has(game.id)}
              inWishlist={wishlist.has(game.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all
              bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]
              hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all
              bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]
              hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-[var(--text-muted)]" />
          </div>
          <p className="font-display text-base font-semibold text-[var(--text-primary)] mb-1">Search the world's largest board game database</p>
          <p className="text-[var(--text-muted)] text-sm max-w-xs">Type a game name and press Enter to search BoardGameGeek's catalogue of over 150,000 games.</p>
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
