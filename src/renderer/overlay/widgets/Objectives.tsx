import { OBJECTIVES } from '@shared/gameConstants'
import type { LiveEvent } from '@shared/types'
import { fmtTime } from '../lanes'

/**
 * Epic monster timers, fully automatic: kills come from Live Client events,
 * respawns from gameConstants. No clicking needed.
 */
export function Objectives({ gameTime, events }: { gameTime: number; events: LiveEvent[] }) {
  const rows = OBJECTIVES.map((o) => {
    const kills = events.filter((e) => e.name === o.killEvent).map((e) => e.time)
    const lastKill = kills.length ? Math.max(...kills) : undefined
    let next: number | null
    if (lastKill === undefined) next = o.firstSpawn
    else if (o.respawn > 0) next = lastKill + o.respawn
    else next = null // one-time objective, already taken
    const expired = o.until !== undefined && gameTime > o.until && lastKill === undefined
    if (expired || next === null) return null
    const left = next - gameTime
    return (
      <div key={o.id} className={`obj ${left <= 0 ? 'up' : left <= 60 ? 'soon' : ''}`}>
        <span>{o.label}</span>
        <span className="mono">{left <= 0 ? 'UP' : fmtTime(left)}</span>
      </div>
    )
  }).filter(Boolean)
  return <div className="objs">{rows.length ? rows : <div className="muted">-</div>}</div>
}
