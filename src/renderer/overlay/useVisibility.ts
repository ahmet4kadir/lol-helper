import { useCallback, useState } from 'react'

const KEY = 'overlay:hidden'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {
    /* ignore */
  }
  return new Set()
}

/** Which overlay widgets the user has closed; persisted per machine. */
export function useVisibility(): { hidden: Set<string>; toggle: (id: string) => void; show: (id: string) => void } {
  const [hidden, setHidden] = useState<Set<string>>(load)
  const persist = (s: Set<string>) => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...s]))
    } catch {
      /* ignore */
    }
    setHidden(s)
  }
  const toggle = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      persist(next)
      return next
    })
  }, [])
  const show = useCallback((id: string) => {
    setHidden((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      persist(next)
      return next
    })
  }, [])
  return { hidden, toggle, show }
}
