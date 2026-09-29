import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import UpdateBanner from './components/UpdateBanner'
import AdminPage from './pages/AdminPage'
import DayPage from './pages/DayPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'
import { ThemeProvider } from './theme/ThemeContext'

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <UpdateBanner />
      </ThemeProvider>
    </AuthProvider>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  // Signed-out users see the login page at any URL, then land where they were headed.
  if (!user) return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="day/:date" element={<DayPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={user.role === 'Admin' ? <AdminPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
