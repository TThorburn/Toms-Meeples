import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { libraryApi } from '../../api/library'
import { useApi } from '../../hooks/useApi'
import { Spinner, ErrorState } from '../ui/primitives'
import { GameDetailModal } from '../games/GameDetailModal'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Trash2, Search, Users, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

import backTexture from '../textures/back.jpg'
import shelf1 from '../textures/shelf-1.jpg'
import shelf2 from '../textures/shelf-2.jpg'
import shelf3 from '../textures/shelf-3.jpg'
import shelf4 from '../textures/shelf-4.jpg'
import shelf5 from '../textures/shelf-5.jpg'
import placeholderGame from '../textures/placeholder-game.jpg'

const SHELF_TEXTURES = [shelf1, shelf2, shelf3, shelf4, shelf5]
const WALL_BG = `url(${backTexture})`

// Base (desktop) dimensions
const BASE = {
  SHELF_HEIGHT: 42,
  SHELF_TOP_HEIGHT: 16,
  BOX_HEIGHT: 120,
  BOX_BASE_WIDTH: 86,
  BOX_GAP: 12,
  SHELF_PADDING: 20,
  BOX_MAX_WIDTH: 180,
  SHELF_MIN_HEIGHT: 170,
}

const MIN_SHELVES = 3

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// Scale all dimensions by a factor (0.5 on mobile)
function scaleDims(scale) {
  return Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, Math.round(v * scale)]))
}

function ShelfPlank({ topTexture, frontTexture, dims }) {
  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: dims.SHELF_HEIGHT, zIndex: 2 }}>
      <div style={{ height: dims.SHELF_TOP_HEIGHT, background: `url(${topTexture})`, backgroundRepeat: 'repeat', backgroundSize: 'auto 50px', boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.25), inset 0 -1px 0 rgba(168,152,86,0.25)' }} />
      <div style={{ height: dims.SHELF_HEIGHT - dims.SHELF_TOP_HEIGHT, background: `url(${frontTexture})`, backgroundRepeat: 'repeat', backgroundSize: 'auto 50px', boxShadow: 'inset 0 1px 0 rgba(95,83,58,0.25), inset 0 -1px 0 rgba(34,23,10,0.28)' }} />
    </div>
  )
}

function GameBox({ item, onRemove, onSelect, removing, onWidthKnown, dims }) {
  const [hovered, setHovered] = useState(false)
  const [boxWidth, setBoxWidth] = useState(dims.BOX_BASE_WIDTH)

  const handleLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget
    if (naturalWidth && naturalHeight) {
      const ratio = naturalWidth / naturalHeight
      const w = clamp(dims.BOX_HEIGHT * ratio, dims.BOX_HEIGHT * 0.5, dims.BOX_MAX_WIDTH)
      setBoxWidth(w)
      onWidthKnown?.(item.gameId, w)
    }
  }, [item.gameId, onWidthKnown, dims])

  const handleError = useCallback((e) => {
    e.currentTarget.src = placeholderGame
    const w = dims.BOX_BASE_WIDTH
    setBoxWidth(w)
    onWidthKnown?.(item.gameId, w)
  }, [item.gameId, onWidthKnown, dims])

  return (
    <motion.div
      layout
      className="relative flex-shrink-0"
      style={{ width: boxWidth, zIndex: hovered ? 20 : 3, overflow: 'visible' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drop shadow */}
      <div style={{ position: 'absolute', left: hovered ? -10 : -8, top: hovered ? 6 : 10, width: '90%', height: '90%', background: 'rgba(0,0,0,0.35)', filter: 'blur(10px)', opacity: hovered ? 0.45 : 0.3, zIndex: 0, pointerEvents: 'none', transition: 'all 0.2s ease' }} />
      {/* Game image - lifts on hover */}
      <div
        className="relative cursor-pointer"
        style={{ height: dims.BOX_HEIGHT, transform: hovered ? 'translateY(-12px)' : 'translateY(0)', transition: 'transform 0.25s cubic-bezier(0.34,1.4,0.64,1)', zIndex: 1 }}
        onClick={() => onSelect(item)}
      >
        <img
          src={item.image || item.thumbnail || placeholderGame}
          alt={item.name}
          onError={handleError}
          onLoad={handleLoad}
          style={{ height: dims.BOX_HEIGHT, borderRadius: 2, display: 'block', boxShadow: hovered ? '6px 10px 22px rgba(0,0,0,0.55)' : '3px 6px 14px rgba(0,0,0,0.45)' }}
        />
        {/* Delete button */}
        <AnimatePresence>
          {hovered && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(190,40,30,0.95)', zIndex: 2 }}
              onClick={e => { e.stopPropagation(); onRemove(item.gameId) }}
              disabled={removing}
            >
              {removing ? <Spinner size="sm" /> : <Trash2 className="w-3 h-3" />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {/* Name label - on outer wrapper so it's above all sibling boxes and never shifts layout */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: '100%',
              marginTop: 4,
              width: 'max-content',
              maxWidth: 130,
              textAlign: 'center',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: 11,
              fontWeight: 600,
              color: '#271908',
              pointerEvents: 'none',
              textShadow: '0 1px 3px rgba(255,255,255,0.7)',
              lineHeight: 1.3,
              whiteSpace: 'normal',
              zIndex: 30,
            }}
          >
            {item.name}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ShelfRow({ items, onRemove, onSelect, removing, onWidthKnown, dims }) {
  const { topTexture, frontTexture } = useMemo(() => {
    const shuffled = [...SHELF_TEXTURES].sort(() => Math.random() - 0.5)
    return { topTexture: shuffled[0], frontTexture: shuffled[1] }
  }, [])

  return (
    <div className="relative w-full" style={{ minHeight: dims.SHELF_MIN_HEIGHT, background: WALL_BG, backgroundRepeat: 'repeat', backgroundSize: 'auto 800px' }}>
      <div className="flex items-end pt-4" style={{ paddingBottom: dims.SHELF_TOP_HEIGHT + 4, paddingLeft: dims.SHELF_PADDING, paddingRight: dims.SHELF_PADDING, position: 'relative', zIndex: 3, gap: `${dims.BOX_GAP}px` }}>
        {items.map(item => (
          <GameBox key={item.gameId} item={item} onRemove={onRemove} onSelect={onSelect} removing={removing === item.gameId} onWidthKnown={onWidthKnown} dims={dims} />
        ))}
      </div>
      <div className="absolute inset-x-0" style={{ bottom: -8, height: 22, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.20), rgba(0,0,0,0))', zIndex: 1, pointerEvents: 'none' }} />
      <ShelfPlank topTexture={topTexture} frontTexture={frontTexture} dims={dims} />
    </div>
  )
}

function EmptyShelfRow({ dims }) {
  const { topTexture, frontTexture } = useMemo(() => {
    const shuffled = [...SHELF_TEXTURES].sort(() => Math.random() - 0.5)
    return { topTexture: shuffled[0], frontTexture: shuffled[1] }
  }, [])
  return (
    <div className="relative w-full" style={{ minHeight: dims.SHELF_MIN_HEIGHT, background: WALL_BG, backgroundRepeat: 'repeat', backgroundSize: 'auto 800px' }}>
      <div style={{ height: dims.SHELF_MIN_HEIGHT - dims.SHELF_HEIGHT }} />
      <div className="absolute inset-x-0" style={{ bottom: -8, height: 22, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.20), rgba(0,0,0,0))', zIndex: 1, pointerEvents: 'none' }} />
      <ShelfPlank topTexture={topTexture} frontTexture={frontTexture} dims={dims} />
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'added', label: 'Date Added' },
  { value: 'rating', label: 'BGG Rating' },
  { value: 'plays', label: 'Most Played' },
]

export function LibraryPage() {
  const { data, loading, error, refetch } = useApi(libraryApi.getAll)
  const [removing, setRemoving] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [filter, setFilter] = useState('')
  const [playerFilter, setPlayerFilter] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)
  const shelfRef = useRef(null)
  const [shelfWidth, setShelfWidth] = useState(1000)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  // Map of gameId -> known actual rendered width (from image onLoad)
  const [knownWidths, setKnownWidths] = useState({})

  useEffect(() => {
    function measure() {
      if (shelfRef.current) setShelfWidth(shelfRef.current.offsetWidth)
      setIsMobile(window.innerWidth < 768)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Scale everything down on mobile
  const dims = useMemo(() => scaleDims(isMobile ? 0.5 : 1), [isMobile])

  const handleWidthKnown = useCallback((gameId, width) => {
    setKnownWidths(prev => {
      if (prev[gameId] === width) return prev
      return { ...prev, [gameId]: width }
    })
  }, [])

  async function handleRemove(id) {
    setRemoving(id)
    await libraryApi.remove(id)
    await refetch()
    setRemoving(null)
  }

  const allGames = data?.games || data || []

  const games = useMemo(() => {
    let filtered = allGames.filter(g => {
      if (filter && !g.name?.toLowerCase().includes(filter.toLowerCase())) return false
      if (playerFilter) {
        const pc = parseInt(playerFilter, 10)
        if (!isNaN(pc) && g.minPlayers && g.maxPlayers) {
          if (pc < g.minPlayers || pc > g.maxPlayers) return false
        }
      }
      return true
    })

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'name': cmp = (a.name || '').localeCompare(b.name || ''); break
        case 'added': cmp = new Date(a.addedAt || 0) - new Date(b.addedAt || 0); break
        case 'rating': cmp = (a.bggRating || 0) - (b.bggRating || 0); break
        case 'plays': cmp = (a.plays || 0) - (b.plays || 0); break
        default: cmp = 0
      }
      return sortAsc ? cmp : -cmp
    })

    return filtered
  }, [allGames, filter, playerFilter, sortBy, sortAsc])

  const shelves = useMemo(() => {
    // Available width for game boxes on each shelf
    const availableWidth = shelfWidth - dims.SHELF_PADDING * 2
    // Fallback width used for games whose image hasn't loaded yet.
    // Use BOX_MAX_WIDTH (pessimistic) so we never overpack a row before images arrive.
    const fallbackWidth = dims.BOX_MAX_WIDTH

    const rows = []
    let currentRow = []
    let currentRowWidth = 0

    for (const game of games) {
      const gameWidth = knownWidths[game.gameId] ?? fallbackWidth
      // Width this game takes including its gap (gap is between items, so add gap for all but the first)
      const addedWidth = currentRow.length === 0 ? gameWidth : dims.BOX_GAP + gameWidth

      if (currentRow.length > 0 && currentRowWidth + addedWidth > availableWidth) {
        // This game won't fit — push current row and start a new one
        rows.push(currentRow)
        currentRow = [game]
        currentRowWidth = gameWidth
      } else {
        currentRow.push(game)
        currentRowWidth += addedWidth
      }
    }

    if (currentRow.length > 0) rows.push(currentRow)
    return rows
  }, [games, knownWidths, shelfWidth, dims])

  const emptyShelvesNeeded = Math.max(0, MIN_SHELVES - shelves.length)

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <h1 className="page-title">Library</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…" className="pl-9 input-field w-36 text-sm" />
          </div>
          {/* Player count filter */}
          <div className="relative">
            <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="number"
              min="1"
              max="20"
              value={playerFilter}
              onChange={e => setPlayerFilter(e.target.value)}
              className="pl-8 input-field w-16 text-sm text-center appearance-none"
              style={{ MozAppearance: 'textfield' }}
            />
          </div>
          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field text-sm w-28 py-2">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => setSortAsc(v => !v)}
            className="p-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title={sortAsc ? 'Ascending' : 'Descending'}
          >
            {sortAsc ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </button>
          {/* Clear */}
          {(filter || playerFilter) && (
            <button onClick={() => { setFilter(''); setPlayerFilter('') }} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Shelf container */}
      <div ref={shelfRef} className="rounded-lg overflow-hidden w-full">
        {shelves.map((items, idx) => (
          <ShelfRow key={idx} items={items} onRemove={handleRemove} onSelect={setSelectedGame} removing={removing} onWidthKnown={handleWidthKnown} dims={dims} />
        ))}
        {Array.from({ length: emptyShelvesNeeded }).map((_, idx) => (
          <EmptyShelfRow key={`empty-${idx}`} dims={dims} />
        ))}
      </div>

      <GameDetailModal gameId={selectedGame?.gameId} open={!!selectedGame} onClose={() => setSelectedGame(null)} isLibraryGame={true} onImageUpdated={refetch} />
    </div>
  )
}
