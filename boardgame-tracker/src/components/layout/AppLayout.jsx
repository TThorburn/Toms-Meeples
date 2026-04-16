import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/auth'
import { useApi } from '../../hooks/useApi'
import { TooltipProvider } from '../ui/Tooltip'
import { Modal } from '../ui/Modal'
import { Button, Input, Badge } from '../ui/primitives'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Search, BookOpen, Star, ClipboardList,
  Trophy, LogOut, Menu, X, Dice6, Settings, CheckCircle2, AlertCircle,
  Shield, UserPlus, Key, Users
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
    <NavLink to={to} end={to === '/'} onClick={onClick} className={({ isActive }) => cn('nav-link', isActive && 'active')}>
      <Icon className="w-4 h-4 flex-shrink-0" /><span>{label}</span>
    </NavLink>
  )
}

// ── Admin Panel ──────────────────────────────────────────────────
function AdminPanel() {
  const { data, refetch } = useApi(authApi.getUsers)
  const [createForm, setCreateForm] = useState({ username: '', password: '', name: '', role: 'user' })
  const [resetForm, setResetForm] = useState({ userId: null, password: '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const usersList = data?.users || []

  async function handleCreate() {
    if (!createForm.username || !createForm.password) { setErr('Username and password required'); return }
    setErr('')
    try {
      await authApi.createUser(createForm)
      setMsg('User created!')
      setCreateForm({ username: '', password: '', name: '', role: 'user' })
      refetch()
      setTimeout(() => setMsg(''), 2000)
    } catch (e) { setErr(e.message) }
  }

  async function handleResetPassword() {
    if (!resetForm.userId || !resetForm.password) return
    try {
      await authApi.resetPassword(resetForm.userId, resetForm.password)
      setMsg('Password reset!')
      setResetForm({ userId: null, password: '' })
      setTimeout(() => setMsg(''), 2000)
    } catch (e) { setErr(e.message) }
  }

  async function handleRoleChange(userId, role) {
    try {
      await authApi.updateUser(userId, { role })
      refetch()
      setMsg(`Role updated to ${role}`)
      setTimeout(() => setMsg(''), 2000)
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="space-y-5">
      {msg && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-900/40 text-green-400 text-sm"><CheckCircle2 className="w-4 h-4" />{msg}</div>}
      {err && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{err}</div>}

      {/* Existing users */}
      <div>
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1"><Users className="w-3.5 h-3.5" />Users ({usersList.length})</div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {usersList.map(u => (
            <div key={u.userId} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)]">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{u.name || u.username}</div>
                <div className="text-[10px] text-[var(--text-muted)]">@{u.username}</div>
              </div>
              <select
                value={u.role}
                onChange={e => handleRoleChange(u.userId, e.target.value)}
                className="text-xs input-field w-20 py-1"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => setResetForm({ userId: u.userId, password: '' })}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-400 transition-colors"
                title="Reset password"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Reset password (if selected) */}
      {resetForm.userId && (
        <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-2">Reset password for {usersList.find(u => u.userId === resetForm.userId)?.username}</div>
          <div className="flex gap-2">
            <input type="password" placeholder="New password" value={resetForm.password} onChange={e => setResetForm(f => ({ ...f, password: e.target.value }))} className="input-field flex-1" />
            <Button size="sm" onClick={handleResetPassword}>Reset</Button>
            <button onClick={() => setResetForm({ userId: null, password: '' })} className="p-2 text-[var(--text-muted)]"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Create user */}
      <div>
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" />Create User</div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input placeholder="Username" value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))} className="input-field flex-1" />
            <input placeholder="Display name" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className="input-field flex-1" />
          </div>
          <div className="flex gap-2">
            <input type="password" placeholder="Password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} className="input-field flex-1" />
            <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))} className="input-field w-24">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button size="sm" onClick={handleCreate} className="w-full"><UserPlus className="w-3.5 h-3.5" />Create User</Button>
        </div>
      </div>
    </div>
  )
}

// ── Account Modal ────────────────────────────────────────────────
function AccountModal({ open, onClose }) {
  const { user, updateUser, isAdmin } = useAuth()
  const [tab, setTab] = useState('profile')
  const [name, setName] = useState(user?.name || user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSave() {
    setError(''); setSuccess('')
    if (newPassword && newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const payload = {}
      if (name && name !== (user?.name || user?.username)) payload.name = name
      if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword }
      if (Object.keys(payload).length === 0) { setError('No changes to save'); setLoading(false); return }
      const data = await authApi.updateAccount(payload)
      if (data.user) updateUser(data.user)
      setSuccess('Account updated!')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings" size="md">
      <div className="p-6">
        {/* Tabs */}
        {isAdmin && (
          <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border-subtle)] mb-5">
            <button onClick={() => setTab('profile')} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${tab === 'profile' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
              <Settings className="w-3.5 h-3.5 inline mr-1.5" />Profile
            </button>
            <button onClick={() => setTab('admin')} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${tab === 'admin' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
              <Shield className="w-3.5 h-3.5 inline mr-1.5" />Admin
            </button>
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-5">
            {error && <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            {success && <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-900/20 border border-green-900/40 text-green-400 text-sm"><CheckCircle2 className="w-4 h-4" />{success}</div>}
            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">Profile</div>
              <Input label="Display Name" value={name} onChange={e => setName(e.target.value)} />
              {user?.role && <div className="mt-2 text-xs text-[var(--text-muted)]">Role: <Badge variant={user.role === 'admin' ? 'amber' : 'default'}>{user.role}</Badge></div>}
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">Change Password</div>
              <div className="space-y-3">
                <Input label="Current Password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={loading} className="flex-1">{loading ? 'Saving…' : 'Save Changes'}</Button>
            </div>
          </div>
        )}

        {tab === 'admin' && isAdmin && <AdminPanel />}
      </div>
    </Modal>
  )
}

// ── Layout ───────────────────────────────────────────────────────
export function AppLayout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  function handleLogout() { logout(); navigate('/login') }

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0"><Dice6 className="w-5 h-5 text-board-950" /></div>
        <div>
          <div className="font-display font-bold text-[var(--text-primary)] leading-tight">Meeple</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Board Game Tracker</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />)}
      </nav>
      <div className="px-3 py-4 border-t border-[var(--border-subtle)]">
        <button onClick={() => setAccountOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] mb-2 hover:border-amber-400/30 transition-colors cursor-pointer text-left">
          <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-amber-400">{(user?.name || user?.username)?.[0]?.toUpperCase() ?? 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate block">{user?.name || user?.username}</span>
            {isAdmin && <span className="text-[10px] text-amber-400">Admin</span>}
          </div>
          <Settings className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </button>
        <button onClick={handleLogout} className="nav-link w-full text-[var(--text-muted)] hover:text-red-400"><LogOut className="w-4 h-4" /><span>Sign out</span></button>
      </div>
    </>
  )

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-subtle)] fixed inset-y-0 left-0 z-30 shadow-sm">{sidebarContent}</aside>
        <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between px-3 h-14 overflow-visible">
          <div className="flex items-center gap-2 min-w-0"><div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0"><Dice6 className="w-4 h-4 text-board-950" /></div><span className="font-display font-bold text-[var(--text-primary)] truncate">Meeple</span></div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="flex-shrink-0 ml-2 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)]">{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
        </header>
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div className="fixed inset-0 z-30 bg-black/60 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
              <motion.aside className="fixed top-14 left-0 bottom-0 z-40 w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] flex flex-col md:hidden" initial={{ x: -64, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -64, opacity: 0 }}>{sidebarContent}</motion.aside>
            </>
          )}
        </AnimatePresence>
        <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8"><Outlet /></div>
        </main>
      </div>
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </TooltipProvider>
  )
}
