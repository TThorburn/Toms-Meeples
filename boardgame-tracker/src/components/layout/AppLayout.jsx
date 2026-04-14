import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { TooltipProvider } from '../ui/Tooltip'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Search, BookOpen, Star, ClipboardList,
  Trophy, LogOut, Menu, X, Dice6
} from 'lucide-react'
import { cn } from '../../utils/cn'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Discover' },
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/wishlist', icon: Star, label: 'Wishlist' },
  { to: '/plays', icon: ClipboardList, label: 'Play Log' },
  { to: '/leagues', icon: Trophy, label: 'Leagues' },
]

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn('nav-link', isActive && 'active')
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
          <Dice6 className="w-5 h-5 text-board-950" />
        </div>
        <div>
          <div className="font-display font-bold text-[var(--text-primary)] leading-tight">Meeple</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Board Game Tracker</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] mb-2">
          <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-amber-400">
              {user?.username?.[0]?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">{user?.username}</span>
        </div>
        <button
          onClick={handleLogout}
          className="nav-link w-full text-[var(--text-muted)] hover:text-red-400"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </>
  )

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-subtle)] fixed inset-y-0 left-0 z-30 shadow-sm">
          {sidebarContent}
        </aside>

        {/* Mobile header */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center">
              <Dice6 className="w-4 h-4 text-board-950" />
            </div>
            <span className="font-display font-bold text-[var(--text-primary)]">Meeple</span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-30 bg-black/60 md:hidden"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                className="fixed top-14 left-0 bottom-0 z-40 w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] flex flex-col md:hidden"
                initial={{ x: -64, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -64, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
