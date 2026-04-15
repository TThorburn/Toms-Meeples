import React, { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Badge, Button, Spinner, ErrorState } from '../ui/primitives'
import { useApi } from '../../hooks/useApi'
import { gamesApi } from '../../api/games'
import {
  Star, Users, Clock, Weight, Calendar,
  Pen, Palette, Building2, BookOpen, Bookmark, CheckCircle2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function InfoRow({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border-subtle)] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[var(--text-muted)]" />
      </div>
      <div>
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</div>
        <div className="text-sm text-[var(--text-primary)]">{value}</div>
      </div>
    </div>
  )
}

function RatingDots({ value, max = 5 }) {
  const filled = Math.round((value / 10) * max)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i < filled ? 'bg-amber-500' : 'bg-[var(--bg-secondary)]'}`} />
      ))}
      <span className="ml-2 text-xs text-[var(--text-muted)]">{value?.toFixed(1)}</span>
    </div>
  )
}

function WeightBar({ value }) {
  const pct = ((value - 1) / 4) * 100
  const labels = ['Light', 'Light-Med', 'Medium', 'Med-Heavy', 'Heavy']
  const idx = Math.round(value - 1)
  return (
    <div>
      <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-1">
        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--text-muted)]">{labels[idx] ?? value?.toFixed(2)}</span>
    </div>
  )
}

// Success overlay shown briefly after adding
function AddedConfirmation({ label, onDone }) {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--bg-raised)] rounded-xl"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-16 h-16 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <p className="font-display text-lg font-semibold text-[var(--text-primary)] mb-1">{label}</p>
      <p className="text-sm text-[var(--text-muted)]">Closing…</p>
    </motion.div>
  )
}

export function GameDetailModal({ gameId, open, onClose, onAddToLibrary, onAddToWishlist }) {
  const [addedMsg, setAddedMsg] = useState(null)

  const { data: game, loading, error } = useApi(
    () => gamesApi.getById(gameId),
    [gameId],
    { immediate: !!gameId && open }
  )

  async function handleAdd(fn, label) {
    if (!game) return
    await fn(game)
    setAddedMsg(label)
    setTimeout(() => {
      setAddedMsg(null)
      onClose()
    }, 1200)
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="relative">
        <AnimatePresence>
          {addedMsg && <AddedConfirmation label={addedMsg} />}
        </AnimatePresence>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}
        {error && <ErrorState message={error} />}
        {!loading && !error && game && (
          <div>
            {/* Hero image + title */}
            <div className="relative">
              {game.image && (
                <div className="h-48 overflow-hidden bg-[var(--bg-secondary)]">
                  <img src={game.image} alt={game.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-raised)] via-transparent to-transparent" />
                </div>
              )}
              <div className={`px-6 ${game.image ? 'pt-3 pb-5' : 'pt-6 pb-5'} ${game.image ? '-mt-16 relative' : ''}`}>
                <div className="flex items-start gap-4">
                  {game.thumbnail && (
                    <img src={game.thumbnail} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-[var(--border-medium)] flex-shrink-0 shadow-lg" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-xl font-bold text-[var(--text-primary)] leading-tight">{game.name}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {game.yearPublished && (
                        <Badge variant="default">
                          <Calendar className="w-3 h-3 mr-1" />{game.yearPublished}
                        </Badge>
                      )}
                      {game.bggRating != null && (
                        <Badge variant="amber">
                          <Star className="w-3 h-3 mr-1" />{game.bggRating?.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                {(onAddToLibrary || onAddToWishlist) && (
                  <div className="flex gap-2 mt-4">
                    {onAddToLibrary && (
                      <Button variant="primary" size="sm" onClick={() => handleAdd(onAddToLibrary, `Added to Library`)}>
                        <BookOpen className="w-3.5 h-3.5" />
                        Add to Library
                      </Button>
                    )}
                    {onAddToWishlist && (
                      <Button variant="secondary" size="sm" onClick={() => handleAdd(onAddToWishlist, `Added to Wishlist`)}>
                        <Bookmark className="w-3.5 h-3.5" />
                        Wishlist
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="px-6 pb-6 space-y-5">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {game.minPlayers != null && (
                  <div className="card p-3 text-center">
                    <Users className="w-4 h-4 text-[var(--text-muted)] mx-auto mb-1" />
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {game.minPlayers === game.maxPlayers ? game.minPlayers : `${game.minPlayers}–${game.maxPlayers}`}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Players</div>
                    {game.bestPlayers && (
                      <div className="text-[10px] text-amber-600 mt-1">Best: {game.bestPlayers}</div>
                    )}
                    {game.recommendedPlayers && game.recommendedPlayers !== game.bestPlayers && (
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Rec: {game.recommendedPlayers}</div>
                    )}
                  </div>
                )}
                {game.playingTime != null && (
                  <div className="card p-3 text-center">
                    <Clock className="w-4 h-4 text-[var(--text-muted)] mx-auto mb-1" />
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{game.playingTime}m</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Play Time</div>
                  </div>
                )}
                {game.weight != null && (
                  <div className="card p-3 text-center">
                    <Weight className="w-4 h-4 text-[var(--text-muted)] mx-auto mb-1" />
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{game.weight?.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Complexity</div>
                  </div>
                )}
              </div>

              {/* Ratings */}
              {game.bggRating != null && (
                <div className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">BGG Rating</span>
                    <RatingDots value={game.bggRating} />
                  </div>
                  {game.weight != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Complexity</span>
                      <div className="w-32"><WeightBar value={game.weight} /></div>
                    </div>
                  )}
                </div>
              )}

              {/* Credits */}
              <div className="card p-4">
                <InfoRow icon={Pen} label="Designers" value={game.designers?.join(', ')} />
                <InfoRow icon={Palette} label="Artists" value={game.artists?.join(', ')} />
                <InfoRow icon={Building2} label="Publishers" value={game.publishers?.join(', ')} />
                {game.recommendedPlayers && (
                  <InfoRow icon={Users} label="Recommended Players" value={game.recommendedPlayers} />
                )}
              </div>

              {/* Description */}
              {game.description && (
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Description</div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-6">
                    {game.description.replace(/<[^>]*>/g, '')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
