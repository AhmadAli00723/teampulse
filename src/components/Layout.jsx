import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, MessageSquare, Heart,
  BarChart2, Users, Target, FileText, Settings, LogOut,
  TrendingUp, UserPlus, Sliders, Sun, Moon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

const NAV = [
  { to: '/dashboard',        label: 'Dashboard',        icon: LayoutDashboard,   roles: ['admin','manager'] },
  { to: '/settings/surveys', label: 'Survey Settings',  icon: Sliders,           roles: ['admin','manager'] },
  { to: '/surveys/answer',   label: 'My Survey',        icon: ClipboardList,     roles: ['member','manager','admin'] },
  { to: '/feedback',         label: 'Feedback',         icon: MessageSquare,     roles: ['member','manager','admin'] },
  { to: '/recognition',      label: 'Recognition',      icon: Heart,             roles: ['member','manager','admin'] },
  { to: '/polls',            label: 'Polls',            icon: BarChart2,         roles: ['member','manager','admin'] },
  { to: '/1on1s',            label: '1-on-1s',          icon: Users,             roles: ['member','manager','admin'] },
  { to: '/goals',            label: 'Goals',            icon: Target,            roles: ['member','manager','admin'] },
  { to: '/reports',          label: 'Reports',          icon: FileText,          roles: ['admin','manager'] },
  { to: '/settings/members', label: 'Members',          icon: UserPlus,          roles: ['admin'] },
  { to: '/settings',         label: 'Org Settings',     icon: Settings,          roles: ['admin'] },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { org, membership } = useOrg()
  const { user } = useAuth()
  const { dark, toggle } = useTheme()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const visibleNav = NAV.filter(n => n.roles.includes(membership?.role))
  const initials = (membership?.full_name ?? user?.email ?? '?')[0].toUpperCase()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — always dark */}
      <aside className="w-60 bg-slate-900 flex flex-col fixed inset-y-0 z-10 shadow-2xl">

        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06]">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-700 rounded-xl flex items-center justify-center shadow-lg">
            <TrendingUp size={15} className="text-white" />
          </div>
          <span className="font-bold text-white tracking-tight text-sm">TeamPulse</span>
        </div>

        {/* Workspace */}
        {org && (
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Workspace</p>
            <p className="text-sm font-semibold text-slate-200 truncate">{org.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-500/20 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-300 truncate leading-tight">
                {membership?.full_name ?? user?.email}
              </p>
              <p className="text-[10px] text-slate-500 capitalize">{membership?.role}</p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={toggle}
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/10 rounded-lg transition-all"
                title={dark ? 'Light mode' : 'Dark mode'}
              >
                {dark ? <Sun size={13} /> : <Moon size={13} />}
              </button>
              <button
                onClick={handleLogout}
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/10 rounded-lg transition-all"
                title="Log out"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>

      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}