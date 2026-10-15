import { useEffect, useRef } from 'react'
import type { LivePlayer, LiveSnapshot } from '@shared/types'
import { lanePairs } from '../lanes'

/**
 * Calibration box for the Tab scoreboard's enemy summoner-spell column:
 * one icon wide, five rows tall, each row split into the top (D) and bottom
 * (F) spell. Place it over the enemy spells once; afterwards a click made
 * while Tab is held is mapped to that enemy and slot, and the matching timer
 * starts together with the game's own.
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
  const latest = useRef({ live, onSpellClick })
  latest.current = { live, onSpellClick }

  useEffect(() => {
    return window.helper.onTabClick(({ x, y }) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Screen -> this window's coordinates. `zoom` is already reflected in the rect.
      const wx = x - window.screenX
      const wy = y - window.screenY
      if (wx < r.left || wx > r.right || wy < r.top || wy > r.bottom) return
      const rowH = r.height / 5
      const row = Math.min(4, Math.floor((wy - r.top) / rowH))
      const slot: '1' | '2' = (wy - r.top) % rowH < rowH / 2 ? '1' : '2'
      const enemies = lanePairs(latest.current.live).map((p) => p.enemy)
      const p = enemies[row]
      if (p) latest.current.onSpellClick(p, slot)
    })
  }, [])

  return (
    <div ref={ref} className={`scoreboard ${editMode ? 'calibrating' : ''}`}>
      {editMode &&
        Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sb-row">
            <span>D</span>
            <span>F</span>
          </div>
        ))}
    </div>
  )
}
