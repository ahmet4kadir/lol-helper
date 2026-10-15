import type { ChampionInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { champIcon } from '../../hooks/useAppState'
import { fmtTime, lanePairs, mySide } from '../lanes'
import type { ReturnInfo } from '../useReturnTimers'
import type { Timer } from './SpellTimers'

/**
 * Lane anchors on the minimap, normalised 0..1 with origin at the bottom-left
 * (blue fountain). Enemy jungle depends on which side you are on.
 */
const ANCHORS: Record<string, { x: number; y: number }> = {
  TOP: { x: 0.2, y: 0.78 },
  MIDDLE: { x: 0.52, y: 0.52 },
  BOTTOM: { x: 0.78, y: 0.2 },
  UTILITY: { x: 0.86, y: 0.3 },
  JUNGLE_RED: { x: 0.64, y: 0.66 },
  JUNGLE_BLUE: { x: 0.36, y: 0.34 }
}

/**
 * Transparent box the user places over the in-game minimap (edit mode: drag
 * it, resize from the corner). Shows, per enemy lane, who is dead / on the way
 * back and which summoner spells are down. Lane positions scale with the box.
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
  const enemies = lanePairs(live)
    .map((x) => ({ lane: x.lane, p: x.enemy }))
    .filter((x): x is { lane: string; p: LivePlayer } => !!x.p)

  return (
    <div className={`minimap ${editMode ? 'calibrating' : ''}`}>
      {editMode && <div className="minimap-hint">Place over the minimap, resize from the corner</div>}
      {enemies.map(({ lane, p }) => {
        const key = lane === 'JUNGLE' ? (side === 'ORDER' ? 'JUNGLE_RED' : 'JUNGLE_BLUE') : lane
        const a = ANCHORS[key] ?? ANCHORS.MIDDLE
        const c = champOf(p)
        const r = info[p.riotId]
        const down: string[] = []
        for (const slot of ['1', '2', 'R']) {
          const tm = timers[`${p.riotId}:${slot}`]
          if (tm && tm.end > t) down.push(`${slot === '1' ? 'D' : slot === '2' ? 'F' : 'R'} ${fmtTime(tm.end - t)}`)
        }
        const show = editMode || r || down.length > 0
        if (!show) return null
        return (
          <div key={p.riotId} className={`mm-marker ${r ? (r.dead ? 'dead' : 'returning') : ''}`} style={{ left: `${a.x * 100}%`, top: `${(1 - a.y) * 100}%` }}>
            {c ? <img src={champIcon(c.key)} alt="" /> : <span className="noimg" />}
            <div className="mm-text mono">
              {r && <div>{r.dead ? `☠ ${fmtTime(r.laneIn)}` : `→ ${fmtTime(r.laneIn)}`}</div>}
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
