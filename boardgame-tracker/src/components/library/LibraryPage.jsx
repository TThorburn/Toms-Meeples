import React, { useState, useMemo, useEffect, useRef } from 'react'
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
const SHELF_HEIGHT = 42
const SHELF_TOP_HEIGHT = 16
const BOX_HEIGHT = 120
const BOX_BASE_WIDTH = 86
const BOX_GAP = 12
const MIN_SHELVES = 3
const SHELF_PADDING = 20

const BOX_MAX_WIDTH = 180

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function ShelfPlank({ topTexture, frontTexture }) {
  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: SHELF_HEIGHT, zIndex: 2 }}>
      <div style={{ height: SHELF_TOP_HEIGHT, background: `url(${topTexture})`, backgroundRepeat: 'repeat', backgroundSize: 'auto 50px', boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.25), inset 0 -1px 0 rgba(168,152,86,0.25)' }} />
      <div style={{ height: SHELF_HEIGHT - SHELF_TOP_HEIGHT, background: `url(${frontTexture})`, backgroundRepeat: 'repeat', backgroundSize: 'auto 50px', boxShadow: 'inset 0 1px 0 rgba(95,83,58,0.25), inset 0 -1px 0 rgba(34,23,10,0.28)' }} />
    </div>
  )
}

function GameBox({ item, onRemove, onSelect, removing }) {
  const [hovered, setHovered] = useState(false)
  const [boxWidth, setBoxWidth] = useState(BOX_BASE_WIDTH)

  return (
    <motion.div layout className="relative flex-shrink-0" style={{ width: boxWidth, zIndex: 3 }}>
      <div style={{ position: 'absolute', left: hovered ? -10 : -8, top: hovered ? 6 : 10, width: '90%', height: '90%', background: 'rgba(0,0,0,0.35)', filter: 'blur(10px)', opacity: hovered ? 0.45 : 0.3, zIndex: 0, pointerEvents: 'none', transition: 'all 0.2s ease' }} />
      <div
        className="relative cursor-pointer"
        style={{ height: BOX_HEIGHT, transform: hovered ? 'translateY(-12px)' : 'translateY(0)', transition: 'transform 0.25s cubic-bezier(0.34,1.4,0.64,1)', zIndex: 1 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(item)}
      >
        <img
          src={item.image || item.thumbnail || placeholderGame}
          alt={item.name}
          onError={e => (e.currentTarget.src = placeholderGame)}
          onLoad={e => {
            const { naturalWidth, naturalHeight } = e.currentTarget
            if (naturalWidth && naturalHeight) {
              const ratio = naturalWidth / naturalHeight
              setBoxWidth(clamp(BOX_HEIGHT * ratio, 60, BOX_MAX_WIDTH))
            }
          }}
          style={{ height: BOX_HEIGHT, borderRadius: 2, display: 'block', boxShadow: hovered ? '6px 10px 22px rgba(0,0,0,0.55)' : '3px 6px 14px rgba(0,0,0,0.45)' }}
        />
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}
              style={{ position: 'absolute', left: -10, right: -10, bottom: -24, textAlign: 'center', fontFamily: '"DM Sans", sans-serif', fontSize: 13, fontWeight: 600, color: '#271908', pointerEvents: 'none', textShadow: '0 1px 2px rgba(255,255,255,0.6)' }}>
              {item.name}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {hovered && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(190,40,30,0.95)' }}
              onClick={e => { e.stopPropagation(); onRemove(item.gameId) }}
              disabled={removing}
            >
              {removing ? <Spinner size="sm" /> : <Trash2 className="w-3 h-3" />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function ShelfRow({ items, onRemove, onSelect, removing }) {
  const { topTexture, frontTexture } = useMemo(() => {
    const shuffled = [...SHELF_TEXTURES].sort(() => Math.random() - 0.5)
    return { topTexture: shuffled[0], frontTexture: shuffled[1] }
  }, [])

  return (
    <div className="relative w-full" style={{ minHeight: 170, background: WALL_BG, backgroundRepeat: 'repeat', backgroundSize: 'auto 800px' }}>
      <div className="flex items-end overflow-hidden pt-4" style={{ paddingBottom: SHELF_TOP_HEIGHT + 4, paddingLeft: SHELF_PADDING, paddingRight: SHELF_PADDING, position: 'relative', zIndex: 3, gap: `${BOX_GAP}px` }}>
        {items.map(item => (
          <GameBox key={item.gameId} item={item} onRemove={onRemove} onSelect={onSelect} removing={removing === item.gameId} />
        ))}
      </div>
      <div className="absolute inset-x-0" style={{ bottom: -8, height: 22, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.20), rgba(0,0,0,0))', zIndex: 1, pointerEvents: 'none' }} />
      <ShelfPlank topTexture={topTexture} frontTexture={frontTexture} />
    </div>
  )
}

function EmptyShelfRow() {
  const { topTexture, frontTexture } = useMemo(() => {
    const shuffled = [...SHELF_TEXTURES].sort(() => Math.random() - 0.5)
    return { topTexture: shuffled[0], frontTexture: shuffled[1] }
  }, [])
  return (
    <div className="relative w-full" style={{ minHeight: 170, background: WALL_BG, backgroundRepeat: 'repeat', backgroundSize: 'auto 800px' }}>
      <div style={{ height: 170 - SHELF_HEIGHT }} />
      <div className="absolute inset-x-0" style={{ bottom: -8, height: 22, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.20), rgba(0,0,0,0))', zIndex: 1, pointerEvents: 'none' }} />
      <ShelfPlank topTexture={topTexture} frontTexture={frontTexture} />
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

  useEffect(() => {
    function measure() { if (shelfRef.current) setShelfWidth(shelfRef.current.offsetWidth) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Use average expected width (most board game boxes are roughly square, ~95px at 120px height)
  const avgBoxWidth = 95
  const booksPerShelf = Math.max(3, Math.floor((shelfWidth - SHELF_PADDING * 2 + BOX_GAP) / (avgBoxWidth + BOX_GAP)))

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
    const rows = []
    for (let i = 0; i < games.length; i += booksPerShelf) {
      rows.push(games.slice(i, i + booksPerShelf))
    }
    return rows
  }, [games, booksPerShelf])

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

      {/* Shelf container — with padding so it doesn't touch sidebar */}
      <div ref={shelfRef} className="rounded-lg overflow-hidden">
        {shelves.map((items, idx) => (
          <ShelfRow key={idx} items={items} onRemove={handleRemove} onSelect={setSelectedGame} removing={removing} />
        ))}
        {Array.from({ length: emptyShelvesNeeded }).map((_, idx) => (
          <EmptyShelfRow key={`empty-${idx}`} />
        ))}
      </div>

      <GameDetailModal gameId={selectedGame?.gameId} open={!!selectedGame} onClose={() => setSelectedGame(null)} isLibraryGame={true} onImageUpdated={refetch} />
    </div>
  )
}
