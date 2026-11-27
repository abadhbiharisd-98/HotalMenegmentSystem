import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Rooms from './pages/Rooms'
import Guests from './pages/Guests'
import Reservations from './pages/Reservations'
import CheckInOut from './pages/CheckInOut'
import Payments from './pages/Payments'
import Invoices from './pages/Invoices'
import Expenses from './pages/Expenses'
import PlaceholderModule from './pages/PlaceholderModule'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Fully Functional Modules */}
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/guests" element={<Guests />} />
              <Route path="/reservations" element={<Reservations />} />
              <Route path="/check-in-out" element={<CheckInOut />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route
                path="/staff"
                element={
                  <PlaceholderModule
                    title="Staff Management"
                    description="Department staff directory, work shift schedules, positions, and staff access roles."
                  />
                }
              />
              <Route
                path="/reports"
                element={
                  <PlaceholderModule
                    title="Reports & Analytics"
                    description="Occupancy rates, revenue trends, monthly sales reports, and guest demographic analysis."
                  />
                }
              />
              <Route
                path="/settings"
                element={
                  <PlaceholderModule
                    title="Settings"
                    description="Hotel property details, tax configurations, currency formatting, and system preferences."
                  />
                }
              />
            </Route>
          </Route>

          {/* Catch-all redirection */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
