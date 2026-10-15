import type { ChampionInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { champIcon } from '../../hooks/useAppState'
import { fmtTime, lanePairs, mySide } from '../lanes'
import type { ReturnInfo } from '../useReturnTimers'
import type { Timer } from './SpellTimers'

/**
 * Lane anchors on the minimap, normalised 0..1 with origin at the bottom-left
 * (blue fountain). Enemy jungle and fountain depend on which side you are on.
 */
const ANCHORS: Record<string, { x: number; y: number }> = {
  TOP: { x: 0.2, y: 0.78 },
  MIDDLE: { x: 0.52, y: 0.52 },
  BOTTOM: { x: 0.78, y: 0.2 },
  UTILITY: { x: 0.86, y: 0.3 },
  JUNGLE_RED: { x: 0.64, y: 0.66 },
  JUNGLE_BLUE: { x: 0.36, y: 0.34 },
  FOUNTAIN_RED: { x: 0.95, y: 0.95 },
  FOUNTAIN_BLUE: { x: 0.05, y: 0.05 }
}

/** Waypoint in the middle of a lane path so icons follow the lane instead of cutting across. */
function waypoint(lane: string, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  if (lane === 'TOP') return { x: from.x, y: to.y } // up the side first, then along
  if (lane === 'BOTTOM' || lane === 'UTILITY') return { x: to.x, y: from.y }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
}

function along(lane: string, from: { x: number; y: number }, to: { x: number; y: number }, p: number): { x: number; y: number } {
  const mid = waypoint(lane, from, to)
  if (p < 0.5) {
    const q = p / 0.5
    return { x: from.x + (mid.x - from.x) * q, y: from.y + (mid.y - from.y) * q }
  }
  const q = (p - 0.5) / 0.5
  return { x: mid.x + (to.x - mid.x) * q, y: mid.y + (to.y - mid.y) * q }
}

/**
 * Transparent box the user places over the in-game minimap (edit mode: drag
 * it, resize from the corner). Dead enemies sit greyed in their fountain with
 * the respawn countdown; once alive (or after "Recall") the icon walks along
 * its lane toward its position as the arrival countdown runs. Spell
 * cooldowns show next to the icon.
 */
export function Minimap({
  live,
  champions,
  info,
  timers,
  editMode
}: {
  live: LiveSnapshot
  champions: Record<number, ChampionInfo>
  info: Record<string, ReturnInfo>
  timers: Record<string, Timer>
  editMode: boolean
}) {
  const side = mySide(live)
  const champOf = (p: LivePlayer) => Object.values(champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
  const t = live.gameTime
  const fountain = side === 'ORDER' ? ANCHORS.FOUNTAIN_RED : ANCHORS.FOUNTAIN_BLUE
  const enemies = lanePairs(live)
    .map((x) => ({ lane: x.lane, p: x.enemy }))
    .filter((x): x is { lane: string; p: LivePlayer } => !!x.p)

  return (
    <div className={`minimap ${editMode ? 'calibrating' : ''}`}>
      {editMode && <div className="minimap-hint">Place over the minimap, resize from the corner</div>}
      {enemies.map(({ lane, p }) => {
        const key = lane === 'JUNGLE' ? (side === 'ORDER' ? 'JUNGLE_RED' : 'JUNGLE_BLUE') : lane
        const target = ANCHORS[key] ?? ANCHORS.MIDDLE
        const c = champOf(p)
        const r = info[p.riotId]
        const down: string[] = []
        for (const slot of ['1', '2', 'R']) {
          const tm = timers[`${p.riotId}:${slot}`]
          if (tm && tm.end > t) down.push(`${slot === '1' ? 'D' : slot === '2' ? 'F' : 'R'} ${fmtTime(tm.end - t)}`)
        }
        const show = editMode || r || down.length > 0
        if (!show) return null
        const pos = r ? (r.dead ? fountain : along(lane, fountain, target, r.progress)) : target
        return (
          <div
            key={p.riotId}
            className={`mm-marker ${r ? (r.dead ? 'dead' : 'returning') : ''}`}
            style={{ left: `${pos.x * 100}%`, top: `${(1 - pos.y) * 100}%` }}
          >
            {c ? <img src={champIcon(c.key)} alt="" /> : <span className="noimg" />}
            <div className="mm-text mono">
              {r && <div>{r.dead ? `☠ ${fmtTime(r.respawnIn)}` : `→ ${fmtTime(r.laneIn)}`}</div>}
              {down.map((d) => (
                <div key={d}>{d}</div>
              ))}
              {editMode && !r && down.length === 0 && <div className="muted">{lane.toLowerCase()}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
