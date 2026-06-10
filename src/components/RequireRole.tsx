import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import type { UserRole } from '../lib/db-rows'

/** Gates a route behind a specific role (client-side). Server-side enforcement
 * is RLS in the database; this just controls navigation/visibility. */
export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { session, role: current, loading } = useAuth()

  if (loading) {
    return <div className="max-w-md mx-auto text-center py-20 text-gray-500">Loading…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (current !== role) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
