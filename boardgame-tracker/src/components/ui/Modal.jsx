import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { motion, AnimatePresence } from 'framer-motion'

function VisuallyHidden({ children }) {
  return (
    <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
      {children}
    </span>
  )
}

export function Modal({ open, onClose, title, children, size = 'md', className }) {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
            <Dialog.Content asChild>
              <motion.div
                className={cn(
                  'relative w-full',
                  sizes[size],
                  'card-raised',
                  'max-h-[90vh] flex flex-col',
                  'overflow-hidden',
                  className,
                )}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Always render a Dialog.Title — visible or hidden */}
                {title ? (
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] flex-shrink-0">
                    <Dialog.Title className="font-display text-lg font-semibold text-[var(--text-primary)]">
                      {title}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <VisuallyHidden><Dialog.Title>Dialog</Dialog.Title></VisuallyHidden>
                )}
                {/* Hidden description to suppress aria warning */}
                <VisuallyHidden><Dialog.Description>Dialog content</Dialog.Description></VisuallyHidden>
                <div className="flex-1 overflow-y-auto">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
              </motion.div>
            </Dialog.Overlay>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
