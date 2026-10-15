import { useEffect, useState } from 'react'
import { CAMPS, type CampDef } from '@shared/gameConstants'
import { fmtTime } from '../lanes'

/**
 * Manual jungle camp timers. Click a camp the moment it dies: the button turns
 * into a respawn countdown. Right-click clears. Before 1:30 every camp shows
 * its first spawn. State resets when a new game starts (game time goes backwards).
 */
export function CampTimers({ gameTime }: { gameTime: number }) {
  const [killed, setKilled] = useState<Record<string, number>>({})
  const [lastT, setLastT] = useState(gameTime)

  useEffect(() => {
    if (gameTime < lastT - 5) setKilled({}) // new game
    setLastT(gameTime)
  }, [gameTime, lastT])

  const mark = (c: CampDef) => setKilled((k) => ({ ...k, [c.id]: gameTime }))
  const clear = (c: CampDef) =>
    setKilled((k) => {
      const n = { ...k }
      delete n[c.id]
      return n
    })

  const render = (c: CampDef) => {
    const t = killed[c.id]
    let label: string
    let cls = 'camp'
    if (gameTime < c.firstSpawn) {
      label = fmtTime(c.firstSpawn - gameTime)
      cls += ' pending'
    } else if (t !== undefined) {
      const left = t + c.respawn - gameTime
      if (left > 0) {
        label = fmtTime(left)
        cls += left <= 15 ? ' soon' : ' dead'
      } else {
        label = 'UP'
        cls += ' up'
      }
    } else {
      label = '-'
    }
    return (
      <button
        key={c.id}
        className={cls}
        onClick={() => mark(c)}
        onContextMenu={(e) => {
          e.preventDefault()
          clear(c)
        }}
        title={`${c.label} · click = died now · right-click = clear`}
      >
        <span className="camp-name">{c.short}</span>
        <span className="camp-time mono">{label}</span>
      </button>
    )
  }

  const blue = CAMPS.filter((c) => c.side === 'blue')
  const red = CAMPS.filter((c) => c.side === 'red')
  const river = CAMPS.filter((c) => c.side === 'river')
  return (
    <div className="camps">
      <div className="camp-col">
        <div className="camp-head" style={{ color: 'var(--blue)' }}>
          Blue side
        </div>
        {blue.map(render)}
      </div>
      <div className="camp-col">
        <div className="camp-head" style={{ color: 'var(--red)' }}>
          Red side
        </div>
        {red.map(render)}
      </div>
      <div className="camp-col">
        <div className="camp-head">River</div>
        {river.map(render)}
      </div>
    </div>
  )
}
