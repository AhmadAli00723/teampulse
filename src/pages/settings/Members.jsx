import { useEffect, useState } from 'react'
import { Users, Mail, Plus, Copy, Clock, Check } from 'lucide-react'
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
  const [members, setMembers]               = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading]               = useState(true)
  const [open, setOpen]                     = useState(false)
  const [inviteEmail, setInviteEmail]       = useState('')
  const [inviteRole, setInviteRole]         = useState('member')
  const [inviting, setInviting]             = useState(false)
  const [inviteLink, setInviteLink]         = useState('')
  const [copied, setCopied]                 = useState(false)

  useEffect(() => {
    if (!org) return
    Promise.all([
      supabase.from('memberships').select('*').eq('org_id', org.id).order('joined_at'),
      supabase.from('invites')
        .select('*')
        .eq('org_id', org.id)
        .eq('accepted', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ]).then(([{ data: m }, { data: i }]) => {
      setMembers(m ?? [])
      setPendingInvites(i ?? [])
      setLoading(false)
    })
  }, [org])

  function buildLink(inviteToken) {
    return `${window.location.origin}/accept-invite?token=${inviteToken}`
  }

  async function sendInvite() {
    if (!inviteEmail) return
    setInviting(true)
    const { data, error } = await supabase.from('invites').insert({
      org_id: org.id, email: inviteEmail, role: inviteRole, invited_by: user.id,
    }).select().single()
    setInviting(false)
    if (error) { alert(error.message); return }
    const link = buildLink(data.token)
    setInviteLink(link)
    setPendingInvites(prev => [data, ...prev])
    // Keep inviteEmail alive so the "Open in email app" button can use it
  }

  function openMailto(email, link) {
    const subject = encodeURIComponent(`You're invited to join ${org.name} on TeamPulse`)
    const body = encodeURIComponent(
      `Hi,\n\nYou've been invited to join ${org.name} on TeamPulse.\n\n` +
      `Click the link below to accept your invitation:\n${link}\n\n` +
      `This invite expires in 7 days.\n\nSee you inside!`
    )
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }

  function copyToClipboard(link) {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function closeModal() {
    setOpen(false)
    setInviteLink('')
    setInviteEmail('')
    setInviteRole('member')
    setCopied(false)
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
            <p className="text-sm text-gray-500 mt-1">
              {members.length} member{members.length !== 1 ? 's' : ''} in {org?.name}
            </p>
          </div>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => { setOpen(true); setInviteLink('') }}
          >
            <Plus size={16} /> Invite member
          </button>
        </div>

        {/* ── Active members ── */}
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" description="Invite your team to get started." />
        ) : (
          <div className="card divide-y divide-gray-50 mb-8">
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

        {/* ── Pending invites ── */}
        {pendingInvites.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock size={14} /> Pending invites ({pendingInvites.length})
            </h2>
            <div className="card divide-y divide-gray-50">
              {pendingInvites.map(inv => {
                const link = buildLink(inv.token)
                return (
                  <div key={inv.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Mail size={15} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => openMailto(inv.email, link)}
                        className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                      >
                        <Mail size={12} /> Resend
                      </button>
                      <button
                        onClick={() => copyToClipboard(link)}
                        className="text-xs text-gray-500 hover:underline flex items-center gap-1"
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Invite modal ── */}
        <Modal open={open} onClose={closeModal} title="Invite member">
          <div className="space-y-4">
            {inviteLink ? (
              /* ── Success state ── */
              <>
                <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                  <Check size={16} /> Invite created!
                </div>
                <p className="text-xs text-gray-500">
                  Send this link to <strong>{inviteEmail}</strong> — it expires in 7 days.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs break-all text-gray-700 select-all">
                  {inviteLink}
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    onClick={() => openMailto(inviteEmail, inviteLink)}
                  >
                    <Mail size={15} /> Open in email app
                  </button>
                  <button
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                    onClick={() => copyToClipboard(inviteLink)}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
                <button
                  className="text-sm text-gray-400 hover:text-gray-600 w-full text-center pt-1"
                  onClick={closeModal}
                >
                  Done
                </button>
              </>
            ) : (
              /* ── Form state ���─ */
              <>
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email" className="input" autoFocus
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendInvite()}
                    placeholder="colleague@company.com"
                  />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <button
                  className="btn-primary w-full flex items-center justify-center gap-2"
                  onClick={sendInvite}
                  disabled={inviting || !inviteEmail}
                >
                  <Mail size={15} />
                  {inviting ? 'Creating invite…' : 'Create invite'}
                </button>
              </>
            )}
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
