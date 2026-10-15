import { useEffect, useRef, useState } from 'react'
import type { ChampionDetail, ChampionInfo, ItemInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { lanePairs } from './lanes'
import { travelTime } from './widgets/BaseTimer'
import { laneShifts } from './turrets'

export interface ReturnInfo {
  /** Seconds until this player is back in their lane (respawn + travel, or travel after respawn / recall). */
  laneIn: number
  /** Seconds until respawn, when dead. */
  respawnIn: number
  dead: boolean
  lane: string
  /** 0..1 progress of the trip from base to lane (0 while dead or still in base). */
  progress: number
}

/**
 * Tracks when each player will be back in lane. Dead players: respawn timer
 * (from the API) plus travel. The moment the API reports them alive again the
 * travel countdown keeps running instead of vanishing. Manual "Recall" /
 * "At base" starts the same countdown for living enemies.
 */
export function useReturnTimers(
  live: LiveSnapshot | null,
  champions: Record<number, ChampionInfo>,
  champDetails: Record<number, ChampionDetail>,
  items: Record<number, ItemInfo>
): {
  info: Record<string, ReturnInfo>
  shifts: Record<'ORDER' | 'CHAOS', Record<string, number>>
  start: (riotId: string, seconds: number) => void
  clear: (riotId: string) => void
} {
  const [arrivals, setArrivals] = useState<Record<string, { end: number; total: number }>>({})
  const wasDead = useRef<Record<string, boolean>>({})
  const lastT = useRef(0)
  const t = live?.gameTime ?? 0

  const champOf = (p: LivePlayer) => Object.values(champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
  const shifts = {
    ORDER: live ? laneShifts(live.events, 'ORDER') : {},
    CHAOS: live ? laneShifts(live.events, 'CHAOS') : {}
  }
  const shiftFor = (p: LivePlayer, lane: string) => shifts[p.team][lane] ?? 0
  const laneOf = (p: LivePlayer): string => {
    if (!live) return 'MIDDLE'
    const pair = lanePairs(live).find((x) => x.ally?.riotId === p.riotId || x.enemy?.riotId === p.riotId)
    return pair?.lane ?? p.position ?? 'MIDDLE'
  }

  useEffect(() => {
    if (!live) return
    if (t < lastT.current - 5) {
      setArrivals({})
      wasDead.current = {}
    }
    lastT.current = t
    const next: Record<string, { end: number; total: number }> = {}
    let changed = false
    for (const p of live.players) {
      const before = wasDead.current[p.riotId] ?? false
      if (before && !p.isDead) {
        // Just respawned: start the travel leg.
        const c = champOf(p)
        const lane = laneOf(p)
        const { travel } = travelTime(p, lane, c ? champDetails[c.id] : undefined, items, shiftFor(p, lane))
        next[p.riotId] = { end: t + travel, total: travel }
        changed = true
      }
      wasDead.current[p.riotId] = p.isDead
    }
    if (changed) setArrivals((a) => ({ ...a, ...next }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const info: Record<string, ReturnInfo> = {}
  if (live) {
    for (const p of live.players) {
      const lane = laneOf(p)
      const c = champOf(p)
      const { travel } = travelTime(p, lane, c ? champDetails[c.id] : undefined, items, shiftFor(p, lane))
      if (p.isDead) {
        const respawnIn = Math.max(0, Math.round(p.respawnTimer))
        info[p.riotId] = { laneIn: respawnIn + travel, respawnIn, dead: true, lane, progress: 0 }
      } else if (arrivals[p.riotId] !== undefined && arrivals[p.riotId].end > t) {
        const a = arrivals[p.riotId]
        const left = a.end - t
        // A manual "Recall" includes the 8s channel before the walk; show no movement during it.
        const walk = Math.min(a.total, travel)
        const progress = left >= walk ? 0 : 1 - left / walk
        info[p.riotId] = { laneIn: Math.round(left), respawnIn: 0, dead: false, lane, progress: Math.max(0, Math.min(1, progress)) }
      }
    }
  }

  return {
    info,
    shifts,
    start: (riotId, seconds) => setArrivals((a) => ({ ...a, [riotId]: { end: t + seconds, total: seconds } })),
    clear: (riotId) =>
      setArrivals((a) => {
        const n = { ...a }
        delete n[riotId]
        return n
      })
  }
}
