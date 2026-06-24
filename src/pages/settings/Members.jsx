import { useEffect, useState } from 'react'
import { Users, Mail, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../lib/constants'
import Layout from '../../components/Layout'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function Members() {
  const { org } = useOrg()
  const { user } = useAuth()
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [open, setOpen]         = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('member')
  const [inviting, setInviting]       = useState(false)
  const [inviteLink, setInviteLink]   = useState('')

  useEffect(() => {
    if (!org) return
    supabase.from('memberships').select('*').eq('org_id', org.id).order('joined_at')
      .then(({ data }) => { setMembers(data ?? []); setLoading(false) })
  }, [org])

  async function sendInvite() {
    if (!inviteEmail) return
    setInviting(true)
    const { data, error } = await supabase.from('invites').insert({
      org_id: org.id, email: inviteEmail, role: inviteRole, invited_by: user.id,
    }).select().single()
    setInviting(false)
    if (error) { alert(error.message); return }
    const link = `${window.location.origin}/accept-invite?token=${data.token}`
    setInviteLink(link)
    setInviteEmail('')
  }

  async function updateRole(memberId, newRole) {
    await supabase.from('memberships').update({ role: newRole }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Members</h1>
            <p className="text-sm text-gray-500 mt-1">{members.length} member{members.length !== 1 ? 's' : ''} in {org?.name}</p>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={() => { setOpen(true); setInviteLink('') }}>
            <Plus size={16} /> Invite member
          </button>
        </div>

        {members.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" description="Invite your team to get started." />
        ) : (
          <div className="card divide-y divide-gray-50">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-bold uppercase flex-shrink-0">
                  {(m.full_name || m.user_id)[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                </div>
                <select
                  value={m.role}
                  onChange={e => updateRole(m.id, e.target.value)}
                  disabled={m.user_id === user.id}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Invite member">
          <div className="space-y-4">
            {inviteLink ? (
              <>
                <p className="text-sm text-green-600 font-medium">Invite created!</p>
                <p className="text-xs text-gray-500 mb-2">Share this link with your teammate:</p>
                <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs break-all text-gray-700">{inviteLink}</div>
                <button className="btn-secondary w-full" onClick={() => navigator.clipboard.writeText(inviteLink)}>
                  Copy link
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Email address</label>
                  <input type="email" className="input" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={sendInvite} disabled={inviting || !inviteEmail}>
                  <Mail size={15} /> {inviting ? 'Generating link…' : 'Generate invite link'}
                </button>
              </>
            )}
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
