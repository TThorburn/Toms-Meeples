import React from 'react'
import { cn } from '../../utils/cn'
import { Loader2, AlertCircle, InboxIcon } from 'lucide-react'

export function Button({ className, variant = 'primary', size = 'md', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none'
  const variants = {
    primary: 'text-white hover:opacity-90 shadow-[0_2px_8px_rgba(193,127,58,0.35)]',
    secondary: 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-medium)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]',
    ghost: 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]',
    danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
    icon: 'p-2 text-sm',
  }
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} style={variant === 'primary' ? { backgroundColor: 'var(--accent)' } : undefined} {...props}>
      {children}
    </button>
  )
}

export function Input({ className, label, error, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input
        className={cn('input-field', error && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10', className)}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

export function Select({ className, label, children, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <select
        className={cn('input-field cursor-pointer', className)}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]',
    amber: 'bg-[var(--accent-dim)] border border-[rgba(193,127,58,0.25)] text-[var(--accent)]',
    green: 'bg-green-900/30 text-green-400 border border-green-900/40',
    red: 'bg-red-900/30 text-red-400 border border-red-900/40',
    blue: 'bg-blue-900/30 text-blue-400 border border-blue-900/40',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}

export function Spinner({ size = 'sm', className }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return <Loader2 className={cn('animate-spin text-[var(--accent)]', sizes[size], className)} />
}

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-3">
        <Spinner size="lg" />
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon = InboxIcon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-raised)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[var(--text-muted)]" />
      </div>
      <h3 className="font-display text-base font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--text-muted)] max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-red-900/20 border border-red-900/30 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-red-400" />
      </div>
      <h3 className="font-display text-base font-semibold text-[var(--text-primary)] mb-1">Something went wrong</h3>
      <p className="text-sm text-[var(--text-muted)] max-w-xs mb-4">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('card p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />
}
