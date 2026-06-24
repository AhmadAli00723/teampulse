import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, MessageSquare, Heart,
  BarChart2, Users, Target, FileText, Settings, LogOut,
  TrendingUp, UserPlus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { to: '/dashboard',      label: 'Dashboard',    icon: LayoutDashboard, roles: ['admin','manager'] },
  { to: '/surveys/answer', label: 'My Survey',     icon: ClipboardList,   roles: ['member','manager','admin'] },
  { to: '/feedback',       label: 'Feedback',      icon: MessageSquare,   roles: ['member','manager','admin'] },
  { to: '/recognition',    label: 'Recognition',   icon: Heart,           roles: ['member','manager','admin'] },
  { to: '/polls',          label: 'Polls',         icon: BarChart2,       roles: ['member','manager','admin'] },
  { to: '/1on1s',          label: '1-on-1s',       icon: Users,           roles: ['member','manager','admin'] },
  { to: '/goals',          label: 'Goals',         icon: Target,          roles: ['member','manager','admin'] },
  { to: '/reports',          label: 'Reports',       icon: FileText,  roles: ['admin','manager'] },
  { to: '/settings/members', label: 'Members',       icon: UserPlus,  roles: ['admin'] },
  { to: '/settings',         label: 'Settings',      icon: Settings,  roles: ['admin'] },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { org, membership } = useOrg()
  const { user } = useAuth()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const visibleNav = NAV.filter(n => n.roles.includes(membership?.role))

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 z-10">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-100">
          <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm tracking-tight">TeamPulse</span>
        </div>

        {/* Org name */}
        {org && (
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Organization</p>
            <p className="text-sm font-medium text-gray-800 truncate mt-0.5">{org.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold uppercase">
              {(membership?.full_name ?? user?.email ?? '?')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">
                {membership?.full_name ?? user?.email}
              </p>
              <p className="text-xs text-gray-400 capitalize">{membership?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 transition-colors" title="Log out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen">
        {children}
      </main>
    </div>
  )
}
