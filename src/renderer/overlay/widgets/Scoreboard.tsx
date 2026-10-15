import { useEffect, useRef, useState } from 'react'
import type { LivePlayer, LiveSnapshot } from '@shared/types'
import { lanePairs } from '../lanes'

type Layout = 'row' | 'column'

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * Calibration box for the Tab scoreboard's enemy summoner-spell area: five
 * rows, each holding the two spells either side by side (default: D left,
 * F right) or stacked. Place it over the enemy spells once; afterwards a
 * click made while Tab is held is mapped to that enemy and slot, and the
 * matching timer starts together with the game's own.
 */
export function Scoreboard({
  live,
  editMode,
  onSpellClick
}: {
  live: LiveSnapshot
  editMode: boolean
  onSpellClick: (p: LivePlayer, slot: '1' | '2') => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout>(() => loadLS('scoreboard:layout', 'row'))
  const [swap, setSwap] = useState<boolean>(() => loadLS('scoreboard:swap', false))
  const latest = useRef({ live, onSpellClick, layout, swap })
  latest.current = { live, onSpellClick, layout, swap }

  useEffect(() => {
    try {
      localStorage.setItem('scoreboard:layout', JSON.stringify(layout))
      localStorage.setItem('scoreboard:swap', JSON.stringify(swap))
    } catch {
      /* ignore */
    }
  }, [layout, swap])

  useEffect(() => {
    return window.helper.onTabClick(({ x, y }) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const wx = x - window.screenX
      const wy = y - window.screenY
      if (wx < r.left || wx > r.right || wy < r.top || wy > r.bottom) return
      const rowH = r.height / 5
      const row = Math.min(4, Math.floor((wy - r.top) / rowH))
      const { layout: L, swap: S } = latest.current
      let first: boolean
      if (L === 'row') first = (wx - r.left) < r.width / 2
      else first = (wy - r.top) % rowH < rowH / 2
      if (S) first = !first
      const slot: '1' | '2' = first ? '1' : '2'
      const enemies = lanePairs(latest.current.live).map((p) => p.enemy)
      const p = enemies[row]
      if (p) latest.current.onSpellClick(p, slot)
    })
  }, [])

  const labels = swap ? ['F', 'D'] : ['D', 'F']
  return (
    <div ref={ref} className={`scoreboard ${layout} ${editMode ? 'calibrating' : ''}`}>
      {editMode && (
        <div className="sb-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button className="close" onClick={() => setLayout(layout === 'row' ? 'column' : 'row')} title="Side by side / stacked">
            {layout === 'row' ? '↔' : '↕'}
          </button>
          <button className="close" onClick={() => setSwap(!swap)} title="Swap D and F">
            ⇄
          </button>
        </div>
      )}
      {editMode &&
        Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sb-row">
            <span>{labels[0]}</span>
            <span>{labels[1]}</span>
          </div>
        ))}
    </div>
  )
}
