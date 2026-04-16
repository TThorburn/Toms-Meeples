import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/auth'
import { Button, Input } from '../ui/primitives'
import { Dice6, AlertCircle, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

function AuthShell({ title, subtitle, children, badge }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl" />
      </div>
      <motion.div className="w-full max-w-sm relative" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center mb-3 shadow-[0_8px_24px_rgba(251,191,36,0.3)]">
            <Dice6 className="w-7 h-7 text-board-950" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">Meeple</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Board Game Tracker</p>
        </div>
        <div className="card-raised p-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
            {badge}
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-6">{subtitle}</p>
          {children}
        </div>
      </motion.div>
    </div>
  )
}

export function SetupPage() {
  const { setup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', confirm: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    authApi.setupStatus().then(data => {
      if (!data.needsSetup) navigate('/login')
      setChecking(false)
    }).catch(() => setChecking(false))
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Please fill in all fields.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError('')
    try {
      await setup(form.username, form.password, form.name || form.username)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Setup failed.')
    } finally { setLoading(false) }
  }

  if (checking) return null

  return (
    <AuthShell
      title="Initial Setup"
      subtitle="Create the admin account to get started."
      badge={<span className="px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-600 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1"><Shield className="w-3 h-3" />Admin</span>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}
        <Input label="Display Name" type="text" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        <Input label="Username" type="text" placeholder="admin" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        <Input label="Password" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        <Input label="Confirm password" type="password" placeholder="Repeat password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        <Button type="submit" className="w-full mt-2" disabled={loading}>{loading ? 'Setting up…' : 'Create Admin Account'}</Button>
      </form>
    </AuthShell>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Check if setup is needed
  useEffect(() => {
    authApi.setupStatus().then(data => {
      if (data.needsSetup) navigate('/setup')
    }).catch(() => {})
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Please fill in all fields.'); return }
    setLoading(true); setError('')
    try {
      await login(form.username, form.password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your account to continue.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}
        <Input label="Username" type="text" placeholder="admin" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoFocus />
        <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        <Button type="submit" className="w-full mt-2" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="text-center text-sm text-[var(--text-muted)] mt-4">
        No account? <Link to="/register" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">Create one</Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Please fill in all fields.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError('')
    try {
      await register(form.username, form.password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally { setLoading(false) }
  }

  return (
    <AuthShell title="Create account" subtitle="Start tracking your board game adventures.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}
        <Input label="Username" type="text" placeholder="your_username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoFocus />
        <Input label="Password" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        <Input label="Confirm password" type="password" placeholder="Repeat password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        <Button type="submit" className="w-full mt-2" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</Button>
      </form>
      <p className="text-center text-sm text-[var(--text-muted)] mt-4">
        Already have an account? <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">Sign in</Link>
      </p>
    </AuthShell>
  )
}
