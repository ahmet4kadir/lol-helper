import type { PlayerProfile, PlayerTrait, RecentGame } from './types'

/**
 * Turns a player's recent games into a handful of blunt, useful judgements:
 * "dies a lot", "never buys control wards", "gets first blood often"…
 * Everything is per-minute or per-game so long and short games compare.
 * Thresholds are deliberately simple; tune them in one place here.
 */

const RANKED = new Set([420, 440])
const MIN_GAMES = 5

export interface PlayerAverages {
  games: number
  deaths: number
  kills: number
  assists: number
  visionPerMin: number
  visionScore: number
  wardsPlaced: number
  wardsKilled: number
  controlWards: number
  firstBloodRate: number // share of games with FB kill or assist
  csPerMin: number
  dmgPerMin: number
  objDmgPerGame: number
  supportShare: number // share of games played as support
  lanes: Record<string, number>
}

function pickGames(recent: RecentGame[]): RecentGame[] {
  const ranked = recent.filter((g) => RANKED.has(g.queueId) && g.durationSec >= 600)
  return ranked.length >= MIN_GAMES ? ranked : recent.filter((g) => g.durationSec >= 600)
}

export function averages(recent: RecentGame[]): PlayerAverages | null {
  const games = pickGames(recent)
  const n = games.length
  if (n === 0) return null
  const sum = (f: (g: RecentGame) => number) => games.reduce((a, g) => a + f(g), 0)
  const minutes = sum((g) => g.durationSec / 60)
  const lanes: Record<string, number> = {}
  for (const g of games) {
    const key = g.role === 'DUO_SUPPORT' ? 'SUPPORT' : g.role === 'DUO_CARRY' ? 'BOTTOM' : g.lane
    lanes[key] = (lanes[key] ?? 0) + 1
  }
  return {
    games: n,
    deaths: sum((g) => g.deaths) / n,
    kills: sum((g) => g.kills) / n,
    assists: sum((g) => g.assists) / n,
    visionPerMin: sum((g) => g.visionScore) / minutes,
    visionScore: sum((g) => g.visionScore) / n,
    wardsPlaced: sum((g) => g.wardsPlaced) / n,
    wardsKilled: sum((g) => g.wardsKilled) / n,
    controlWards: sum((g) => g.controlWards) / n,
    firstBloodRate: sum((g) => (g.firstBloodKill || g.firstBloodAssist ? 1 : 0)) / n,
    csPerMin: sum((g) => g.cs) / minutes,
    dmgPerMin: sum((g) => g.damageToChamps) / minutes,
    objDmgPerGame: sum((g) => g.damageToObjectives) / n,
    supportShare: (lanes.SUPPORT ?? 0) / n,
    lanes
  }
}

/** Lane the player is in right now, in match-history vocabulary (TOP/JUNGLE/MIDDLE/BOTTOM/SUPPORT). */
export function currentLaneKey(position: string): string {
  const p = position.toUpperCase()
  if (p === 'UTILITY') return 'SUPPORT'
  return p
}

export function playerTraits(profile: PlayerProfile, currentPosition?: string): PlayerTrait[] {
  const a = averages(profile.recent)
  if (!a || a.games < 3) return []
  const out: PlayerTrait[] = []
  const isSupport = a.supportShare >= 0.5
  const f = (n: number, d = 1) => n.toFixed(d)

  // Vision — thresholds differ for supports.
  const visGood = isSupport ? 2.0 : 1.0
  const visBad = isSupport ? 1.2 : 0.5
  if (a.visionPerMin >= visGood) out.push({ label: 'Good vision', tone: 'good', detail: `${f(a.visionPerMin, 2)} vision/min` })
  else if (a.visionPerMin < visBad) out.push({ label: 'Barely wards', tone: 'bad', detail: `${f(a.visionPerMin, 2)} vision/min, ${f(a.wardsPlaced)} wards/game` })

  if (a.controlWards < 0.5) out.push({ label: 'No control wards', tone: 'bad', detail: `${f(a.controlWards)} pinks/game` })
  else if (a.controlWards >= 2) out.push({ label: 'Buys pinks', tone: 'good', detail: `${f(a.controlWards)} pinks/game` })

  if (a.wardsKilled >= 4) out.push({ label: 'Clears wards', tone: 'good', detail: `${f(a.wardsKilled)} wards killed/game` })

  // Deaths.
  if (a.deaths >= 7) out.push({ label: 'Dies a lot', tone: 'bad', detail: `${f(a.deaths)} deaths/game` })
  else if (a.deaths <= 3) out.push({ label: 'Rarely dies', tone: 'good', detail: `${f(a.deaths)} deaths/game` })

  // First blood involvement.
  if (a.firstBloodRate >= 0.3) out.push({ label: 'First blood hunter', tone: 'good', detail: `in ${Math.round(a.firstBloodRate * 100)}% of games` })

  // Farm and damage (not for supports).
  if (!isSupport) {
    if (a.csPerMin >= 7.5) out.push({ label: 'Farms well', tone: 'good', detail: `${f(a.csPerMin)} cs/min` })
    else if (a.csPerMin < 5) out.push({ label: 'Low CS', tone: 'bad', detail: `${f(a.csPerMin)} cs/min` })
    if (a.dmgPerMin >= 800) out.push({ label: 'High damage', tone: 'good', detail: `${Math.round(a.dmgPerMin)} dmg/min to champions` })
    else if (a.dmgPerMin < 350) out.push({ label: 'Low damage', tone: 'bad', detail: `${Math.round(a.dmgPerMin)} dmg/min to champions` })
  }
  if (a.objDmgPerGame >= 15000) out.push({ label: 'Takes objectives', tone: 'good', detail: `${Math.round(a.objDmgPerGame / 1000)}k objective dmg/game` })

  // Form.
  const last5 = profile.recent.slice(0, 5)
  if (last5.length === 5 && last5.every((g) => g.win)) out.push({ label: 'Win streak', tone: 'good', detail: '5 wins in a row' })
  const lossStreak = profile.recent.findIndex((g) => g.win)
  if (lossStreak >= 4 || (lossStreak === -1 && profile.recent.length >= 4))
    out.push({ label: 'Tilted', tone: 'bad', detail: `${lossStreak === -1 ? profile.recent.length : lossStreak} losses in a row` })

  // Role fit.
  if (currentPosition) {
    const key = currentLaneKey(currentPosition)
    const share = (a.lanes[key] ?? 0) / a.games
    if (share < 0.2) {
      const main = Object.entries(a.lanes).sort((x, y) => y[1] - x[1])[0]?.[0]
      out.push({ label: 'Off-role', tone: 'bad', detail: `usually ${main?.toLowerCase() ?? 'elsewhere'}, ${Math.round(share * 100)}% here` })
    }
  }

  // One-trick.
  const top = profile.champions[0]
  if (top && top.games >= 3 && top.games / a.games >= 0.6) out.push({ label: 'One-trick', tone: 'neutral', detail: `${Math.round((top.games / a.games) * 100)}% of games on one champion` })

  return out
}
