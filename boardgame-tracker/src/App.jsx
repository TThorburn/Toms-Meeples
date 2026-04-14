import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage, RegisterPage } from './components/auth/AuthPages'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { SearchPage } from './components/games/SearchPage'
import { LibraryPage } from './components/library/LibraryPage'
import { WishlistPage } from './components/wishlist/WishlistPage'
import { PlaysPage } from './components/plays/PlaysPage'
import { LeaguesPage } from './components/leagues/LeaguesPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="plays" element={<PlaysPage />} />
          <Route path="leagues" element={<LeaguesPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
