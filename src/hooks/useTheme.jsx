import { useEffect, useState } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem('tp-theme')
      if (stored) return stored === 'dark'
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('tp-theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark(d => !d) }
}