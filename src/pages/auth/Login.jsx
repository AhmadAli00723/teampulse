import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

function ParticleCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    const PARTICLE_COUNT = 80
    const CONNECTION_DIST = 130
    const CURSOR_DIST     = 160  // lines snap to cursor within this radius
    const REPEL_DIST      = 100  // particles flee cursor within this radius
    const REPEL_FORCE     = 0.6
    const DAMPING         = 0.96 // velocity decay each frame
    const BASE_SPEED      = 0.4

    const mouse = { x: -9999, y: -9999 }

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function onMove(e) {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    function onLeave() {
      mouse.x = -9999
      mouse.y = -9999
    }
    function onClick(e) {
      // Burst: kick all particles within REPEL_DIST * 2 away from click
      for (const p of particles) {
        const dx = p.x - e.clientX
        const dy = p.y - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < REPEL_DIST * 2 && dist > 0) {
          const force = (1 - dist / (REPEL_DIST * 2)) * 5
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('click', onClick)

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * BASE_SPEED,
      vy: (Math.random() - 0.5) * BASE_SPEED,
      r:  Math.random() * 2 + 1.2,
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // move + repel from cursor
      for (const p of particles) {
        const mdx = p.x - mouse.x
        const mdy = p.y - mouse.y
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy)

        if (mDist < REPEL_DIST && mDist > 0) {
          const force = (1 - mDist / REPEL_DIST) * REPEL_FORCE
          p.vx += (mdx / mDist) * force
          p.vy += (mdy / mDist) * force
        }

        p.vx *= DAMPING
        p.vy *= DAMPING

        // Keep a minimum drift so particles don't fully stop
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed < BASE_SPEED * 0.3) {
          p.vx += (Math.random() - 0.5) * 0.05
          p.vy += (Math.random() - 0.5) * 0.05
        }

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      }

      // particle–particle connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(79,70,229,${0.18 * (1 - dist / CONNECTION_DIST)})`
            ctx.lineWidth = 1
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // cursor → particle connections (bright lines to nearby particles)
      for (const p of particles) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < CURSOR_DIST) {
          const alpha = 0.55 * (1 - dist / CURSOR_DIST)
          ctx.beginPath()
          ctx.strokeStyle = `rgba(129,140,248,${alpha})`
          ctx.lineWidth = 1.2
          ctx.moveTo(mouse.x, mouse.y)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }
      }

      // cursor glow dot
      if (mouse.x > 0) {
        const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 28)
        grd.addColorStop(0,   'rgba(129,140,248,0.22)')
        grd.addColorStop(1,   'rgba(129,140,248,0)')
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 28, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()
      }

      // dots — particles near cursor glow brighter and slightly larger
      for (const p of particles) {
        const dx   = p.x - mouse.x
        const dy   = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const near = dist < CURSOR_DIST
        const t    = near ? (1 - dist / CURSOR_DIST) : 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r + t * 1.8, 0, Math.PI * 2)
        ctx.fillStyle = near
          ? `rgba(129,140,248,${0.55 + t * 0.45})`
          : 'rgba(99,102,241,0.45)'
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

export default function Login() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const token          = searchParams.get('token') // invite token, if present

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    // If we came from an invite link, go back to accept it
    navigate(token ? `/accept-invite?token=${token}` : '/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      <ParticleCanvas />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">TeamPulse</span>
        </div>

        <div className="card">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-6">
            {token ? 'Sign in to accept your invitation' : 'Sign in to your account'}
          </p>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" required className="input"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" required className="input"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            No account?{' '}
            {/* Pass the token along so signup also returns to accept-invite */}
            <Link
              to={token ? `/signup?token=${token}` : '/signup'}
              className="text-brand-600 font-medium hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
