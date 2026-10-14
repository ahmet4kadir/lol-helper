import type { LivePlayer, LiveSnapshot } from '@shared/types'

export const LANE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
export const LANE_SHORT: Record<string, string> = { TOP: 'Top', JUNGLE: 'Jg', MIDDLE: 'Mid', BOTTOM: 'Bot', UTILITY: 'Sup' }

export interface LanePair {
  lane: string
  ally?: LivePlayer
  enemy?: LivePlayer
}

export function itemGold(p: LivePlayer): number {
  return p.items.reduce((a, i) => a + i.price * i.count, 0)
}

export function mySide(live: LiveSnapshot): 'ORDER' | 'CHAOS' {
  const me = live.activePlayer?.riotId
  return live.players.find((p) => p.riotId === me)?.team ?? 'ORDER'
}

export function splitTeams(live: LiveSnapshot): { ally: LivePlayer[]; enemy: LivePlayer[] } {
  const side = mySide(live)
  return {
    ally: live.players.filter((p) => p.team === side),
    enemy: live.players.filter((p) => p.team !== side)
  }
}

/** Pair allies and enemies by position; fall back to list order when positions are missing. */
export function lanePairs(live: LiveSnapshot): LanePair[] {
  const { ally, enemy } = splitTeams(live)
  const hasPos = live.players.some((p) => p.position)
  if (hasPos) {
    return LANE_ORDER.map((lane) => ({
      lane,
      ally: ally.find((p) => p.position === lane),
      enemy: enemy.find((p) => p.position === lane)
    }))
  }
  return LANE_ORDER.map((lane, i) => ({ lane, ally: ally[i], enemy: enemy[i] }))
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function sign(n: number): string {
  return n > 0 ? '+' : ''
}
