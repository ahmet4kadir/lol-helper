import type { LiveEvent } from '@shared/types'
import { TURRET_STEP } from '@shared/gameConstants'

/**
 * Lane front shift from destroyed turrets, per lane, for a player on `team`.
 * Turret names look like "Turret_T1_L_03_A": T1 = blue (ORDER), T2 = red
 * (CHAOS); L/C/R are from that team's own point of view, so T1_L and T2_R are
 * both top lane. When your own turrets fall the front moves toward your base
 * (shorter trip back); when the enemy's fall you walk further.
 */
export function laneShifts(events: LiveEvent[], team: 'ORDER' | 'CHAOS'): Record<string, number> {
  const lost: Record<string, Set<string>> = { TOP: new Set(), MIDDLE: new Set(), BOTTOM: new Set() }
  const taken: Record<string, Set<string>> = { TOP: new Set(), MIDDLE: new Set(), BOTTOM: new Set() }
  for (const e of events) {
    if (e.name !== 'TurretKilled') continue
    const name = String((e as Record<string, unknown>).TurretKilled ?? '')
    const m = /Turret_T(\d)_([LCR])_(\d+)/.exec(name)
    if (!m) continue
    const owner: 'ORDER' | 'CHAOS' = m[1] === '1' ? 'ORDER' : 'CHAOS'
    const side = m[2]
    const lane = side === 'C' ? 'MIDDLE' : owner === 'ORDER' ? (side === 'L' ? 'TOP' : 'BOTTOM') : side === 'R' ? 'TOP' : 'BOTTOM'
    ;(owner === team ? lost : taken)[lane].add(m[3])
  }
  const out: Record<string, number> = {}
  for (const lane of ['TOP', 'MIDDLE', 'BOTTOM']) out[lane] = (taken[lane].size - lost[lane].size) * TURRET_STEP
  out.UTILITY = out.BOTTOM
  out.JUNGLE = 0
  return out
}
