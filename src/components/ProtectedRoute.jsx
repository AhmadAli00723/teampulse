import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading: authLoading } = useAuth()
  const { membership, loading: orgLoading } = useOrg()

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!membership) return <Navigate to="/onboarding" replace />

  if (requiredRole) {
    const hierarchy = { admin: 3, manager: 2, member: 1 }
    const userLevel = hierarchy[membership.role] ?? 0
    const required  = hierarchy[requiredRole] ?? 0
    if (userLevel < required) return <Navigate to="/dashboard" replace />
  }

  return children
}
