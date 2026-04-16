import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback
} from 'react'

import { libraryApi } from '../../api/library'
import { useApi } from '../../hooks/useApi'
import { Spinner, ErrorState } from '../ui/primitives'
import { GameDetailModal } from '../games/GameDetailModal'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2,
  Search,
  Users,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react'

import backTexture from '../textures/back.jpg'
import shelf1 from '../textures/shelf-1.jpg'
import shelf2 from '../textures/shelf-2.jpg'
import shelf3 from '../textures/shelf-3.jpg'
import shelf4 from '../textures/shelf-4.jpg'
import shelf5 from '../textures/shelf-5.jpg'
import placeholderGame from '../textures/placeholder-game.jpg'

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const SHELF_TEXTURES = [shelf1, shelf2, shelf3, shelf4, shelf5]
const WALL_BG = `url(${backTexture})`

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

function scaleDims(scale) {
  return Object.fromEntries(
    Object.entries(BASE).map(([k, v]) => [k, Math.round(v * scale)])
  )
}

/* -------------------------------------------------------------------------- */
/* Game Box                                                                    */
/* -------------------------------------------------------------------------- */

function GameBox({
  item,
  onRemove,
  onSelect,
  removing,
  onWidthKnown,
  dims
}) {
  const [hovered, setHovered] = useState(false)
  const boxRef = useRef(null)

  const handleLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget
    if (!naturalWidth || !naturalHeight) return

    const ratio = naturalWidth / naturalHeight
    const width = clamp(
      dims.BOX_HEIGHT * ratio,
      dims.BOX_HEIGHT * 0.5,
      dims.BOX_MAX_WIDTH
    )

    onWidthKnown?.(item.gameId, width)
  }, [item.gameId, onWidthKnown, dims])

  const handleError = useCallback((e) => {
    e.currentTarget.src = placeholderGame
    onWidthKnown?.(item.gameId, dims.BOX_BASE_WIDTH)
  }, [item.gameId, onWidthKnown, dims])

  return (
    <div
      ref={boxRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer"
      onClick={() => onSelect(item)}
    >
      <img
        src={item.imageUrl}
        onLoad={handleLoad}
        onError={handleError}
        alt={item.name}
        style={{ height: dims.BOX_HEIGHT }}
        className="transition-transform hover:-translate-y-1"
      />

      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(item.gameId)
          }}
          disabled={removing}
          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Shelf Row                                                                   */
/* -------------------------------------------------------------------------- */

function ShelfRow({
  items,
  onRemove,
  onSelect,
  removing,
  onWidthKnown,
  dims
}) {
  const { topTexture, frontTexture } = useMemo(() => {
    const shuffled = [...SHELF_TEXTURES].sort(() => Math.random() - 0.5)
    return { topTexture: shuffled[0], frontTexture: shuffled[1] }
  }, [])

  return (
    <div className="mb-6">
      <div
        className="flex items-end"
        style={{ gap: dims.BOX_GAP }}
      >
        {items.map(item => (
          <GameBox
            key={item.gameId}
            item={item}
            onRemove={onRemove}
            onSelect={onSelect}
            removing={removing === item.gameId}
            onWidthKnown={onWidthKnown}
            dims={dims}
          />
        ))}
      </div>

      <div
        className="h-[42px]"
        style={{
          backgroundImage: `url(${frontTexture})`
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Library Page                                                                */
/* -------------------------------------------------------------------------- */

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

  const [knownWidths, setKnownWidths] = useState({})

  /* -------------------- layout measurement -------------------------------- */

  useEffect(() => {
    function measure() {
      if (shelfRef.current) {
        setShelfWidth(shelfRef.current.offsetWidth)
      }
      setIsMobile(window.innerWidth < 768)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const dims = useMemo(
    () => scaleDims(isMobile ? 0.5 : 1),
    [isMobile]
  )

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

  /* -------------------- data ---------------------------------------------- */

  const allGames = data?.games ?? []

  const games = useMemo(() => {
    let filtered = allGames.filter(g => {
      if (filter && !g.name?.toLowerCase().includes(filter.toLowerCase()))
        return false

      if (playerFilter) {
        const pc = parseInt(playerFilter, 10)
        if (!isNaN(pc)) {
          if (
            (g.minPlayers && pc < g.minPlayers) ||
            (g.maxPlayers && pc > g.maxPlayers)
          ) return false
        }
      }

      return true
    })

    filtered.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'name':
          cmp = (a.name ?? '').localeCompare(b.name ?? '')
          break
        case 'added':
          cmp = new Date(a.addedAt ?? 0) - new Date(b.addedAt ?? 0)
          break
        case 'rating':
          cmp = (a.bggRating ?? 0) - (b.bggRating ?? 0)
          break
        case 'plays':
          cmp = (a.plays ?? 0) - (b.plays ?? 0)
          break
        default:
          break
      }
      return sortAsc ? cmp : -cmp
    })

    return filtered
  }, [allGames, filter, playerFilter, sortBy, sortAsc])

  /* -------------------- BEST FIX ------------------------------------------ */

  const allWidthsKnown = useMemo(() => {
    if (!games.length) return false
    return games.every(g =>
      typeof knownWidths[g.gameId] === 'number'
    )
  }, [games, knownWidths])

  const shelves = useMemo(() => {
    if (!allWidthsKnown) return []

    const availableWidth = shelfWidth - dims.SHELF_PADDING * 2
    const rows = []

    let currentRow = []
    let currentWidth = 0

    for (const game of games) {
      const w = knownWidths[game.gameId]
      const added = currentRow.length === 0
        ? w
        : dims.BOX_GAP + w

      if (
        currentRow.length > 0 &&
        currentWidth + added > availableWidth
      ) {
        rows.push(currentRow)
        currentRow = [game]
        currentWidth = w
      } else {
        currentRow.push(game)
        currentWidth += added
      }
    }

    if (currentRow.length) rows.push(currentRow)
    return rows
  }, [games, knownWidths, shelfWidth, dims, allWidthsKnown])

  const emptyShelvesNeeded = Math.max(
    0,
    MIN_SHELVES - shelves.length
  )

  /* -------------------- states ------------------------------------------- */

  if (loading) return <Spinner />
  if (error) return <ErrorState />

  return (
    <div
      ref={shelfRef}
      style={{ backgroundImage: WALL_BG }}
      className="min-h-screen p-6"
    >
      <h2 className="text-2xl font-bold mb-4">Library</h2>

      {/* controls */}
      <div className="flex gap-2 mb-6">
        <div className="relative">
          <Search className="absolute left-2 top-2.5" size={16} />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search…"
            className="pl-8 input-field"
          />
        </div>

        <div className="relative">
          <Users className="absolute left-2 top-2.5" size={16} />
          <input
            value={playerFilter}
            onChange={e => setPlayerFilter(e.target.value)}
            className="pl-8 input-field w-16 text-center"
          />
        </div>

        <button
          onClick={() => setSortAsc(v => !v)}
          className="p-2 border rounded"
        >
          {sortAsc ? <ArrowUp /> : <ArrowDown />}
        </button>

        {(filter || playerFilter) && (
          <button
            onClick={() => {
              setFilter('')
              setPlayerFilter('')
            }}
          >
            <X />
          </button>
        )}
      </div>

      {/* shelves */}
      {!allWidthsKnown && (
        <div className="py-20 flex justify-center">
          <Spinner />
        </div>
      )}

      {allWidthsKnown && shelves.map((items, i) => (
        <ShelfRow
          key={i}
          items={items}
          onRemove={handleRemove}
          onSelect={setSelectedGame}
          removing={removing}
          onWidthKnown={handleWidthKnown}
          dims={dims}
        />
      ))}

      <AnimatePresence>
        {selectedGame && (
          <GameDetailModal
            game={selectedGame}
            onClose={() => setSelectedGame(null)}
            isLibraryGame
            onImageUpdated={refetch}
          />
        )}
      </AnimatePresence>
    </div>
  )
}