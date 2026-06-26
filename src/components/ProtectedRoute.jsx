import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading: authLoading } = useAuth()
  const { membership, loading: orgLoading } = useOrg()
  const location = useLocation()

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    // Preserve where the user was headed (e.g. the survey link from an email)
    // so Login can send them back there after they sign in.
    const dest = location.pathname + location.search
    return <Navigate to={`/login?redirect=${encodeURIComponent(dest)}`} replace />
  }

  if (!membership) {
    // User confirmed their email from an invite — token was saved in localStorage
    const pendingToken = localStorage.getItem('pendingInviteToken')
    if (pendingToken) return <Navigate to={`/accept-invite?token=${pendingToken}`} replace />
    return <Navigate to="/onboarding" replace />
  }

  if (requiredRole) {
    const hierarchy = { admin: 3, manager: 2, member: 1 }
    const userLevel = hierarchy[membership.role] ?? 0
    const required  = hierarchy[requiredRole] ?? 0
    // Redirect members away from manager/admin pages without looping
    if (userLevel < required) return <Navigate to="/surveys/answer" replace />
  }

  return children
}
