import React, { useState, useMemo, useEffect, useRef } from 'react'
import { libraryApi } from '../../api/library'
import { useApi } from '../../hooks/useApi'
import { Spinner, ErrorState } from '../ui/primitives'
import { GameDetailModal } from '../games/GameDetailModal'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Trash2, Search, Users, X } from 'lucide-react'

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
const BOX_WIDTH = 86
const BOX_GAP = 12

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
  const [boxWidth, setBoxWidth] = useState(BOX_WIDTH)

  return (
    <motion.div layout className="relative" style={{ width: boxWidth, zIndex: 3 }}>
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
              setBoxWidth(clamp(BOX_HEIGHT * ratio, 60, 180))
            }
          }}
          style={{ height: BOX_HEIGHT, borderRadius: 2, display: 'block', boxShadow: hovered ? '6px 10px 22px rgba(0,0,0,0.55)' : '3px 6px 14px rgba(0,0,0,0.45)' }}
        />
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}
              style={{ position: 'absolute', left: 0, right: 0, bottom: -22, textAlign: 'center', fontFamily: '"DM Sans", sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', color: '#271908', pointerEvents: 'none' }}>
              {item.name}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {hovered && (
            <motion.button
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

function ShelfRow({ items, booksPerShelf, onRemove, onSelect, removing }) {
  const slots = [...items]
  while (slots.length < booksPerShelf) slots.push(null)

  const { topTexture, frontTexture } = useMemo(() => {
    const shuffled = [...SHELF_TEXTURES].sort(() => Math.random() - 0.5)
    return { topTexture: shuffled[0], frontTexture: shuffled[1] }
  }, [])

  return (
    <div className="relative" style={{ minHeight: 170, background: WALL_BG, backgroundRepeat: 'repeat', backgroundSize: 'auto 800px' }}>
      <div className="flex items-end gap-3 px-5 pt-4" style={{ paddingBottom: SHELF_TOP_HEIGHT, position: 'relative', zIndex: 3 }}>
        {slots.map((item, idx) =>
          item ? (
            <GameBox key={item.gameId} item={item} onRemove={onRemove} onSelect={onSelect} removing={removing === item.gameId} />
          ) : (
            <div key={idx} style={{ width: BOX_WIDTH }} />
          )
        )}
      </div>
      <div className="absolute inset-x-0" style={{ bottom: -8, height: 22, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.20), rgba(0,0,0,0))', zIndex: 1, pointerEvents: 'none' }} />
      <ShelfPlank topTexture={topTexture} frontTexture={frontTexture} />
    </div>
  )
}

export function LibraryPage() {
  const { data, loading, error, refetch } = useApi(libraryApi.getAll)
  const [removing, setRemoving] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [filter, setFilter] = useState('')
  const [playerFilter, setPlayerFilter] = useState('')
  const shelfRef = useRef(null)
  const [shelfWidth, setShelfWidth] = useState(1000)

  // Measure shelf container width for responsive scaling
  useEffect(() => {
    function measure() {
      if (shelfRef.current) setShelfWidth(shelfRef.current.offsetWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const booksPerShelf = Math.max(3, Math.floor((shelfWidth - 40) / (BOX_WIDTH + BOX_GAP)))

  async function handleRemove(id) {
    setRemoving(id)
    await libraryApi.remove(id)
    await refetch()
    setRemoving(null)
  }

  const allGames = data?.games || data || []
  const games = allGames.filter(g => {
    if (filter && !g.name?.toLowerCase().includes(filter.toLowerCase())) return false
    if (playerFilter) {
      const pc = parseInt(playerFilter, 10)
      if (!isNaN(pc) && g.minPlayers && g.maxPlayers) {
        if (pc < g.minPlayers || pc > g.maxPlayers) return false
      }
    }
    return true
  })

  const shelves = useMemo(() => {
    const rows = []
    for (let i = 0; i < games.length; i += booksPerShelf) {
      rows.push(games.slice(i, i + booksPerShelf))
    }
    while (rows.length < 3) rows.push([])
    return rows
  }, [games, booksPerShelf])

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <h1 className="page-title">Library</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…" className="pl-9 input-field w-40" />
          </div>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="number" min="1" max="20" value={playerFilter} onChange={e => setPlayerFilter(e.target.value)} placeholder="Players" className="pl-9 input-field w-28" />
          </div>
          {(filter || playerFilter) && (
            <button onClick={() => { setFilter(''); setPlayerFilter('') }} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div ref={shelfRef} className="border rounded overflow-hidden">
        {shelves.map((items, idx) => (
          <ShelfRow key={idx} items={items} booksPerShelf={booksPerShelf} onRemove={handleRemove} onSelect={setSelectedGame} removing={removing} />
        ))}
      </div>

      <GameDetailModal gameId={selectedGame?.gameId} open={!!selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  )
}
