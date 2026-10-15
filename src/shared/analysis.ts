import type { ChampionInfo, DamageType } from './types'
import { CHAMPION_META } from './championMeta'

export const LANES = ['top', 'jungle', 'middle', 'bottom', 'utility'] as const
export type Lane = (typeof LANES)[number]

export const LANE_LABEL: Record<string, string> = {
  top: 'Top',
  jungle: 'Jungle',
  middle: 'Mid',
  bottom: 'ADC',
  utility: 'Support',
  '': '-'
}

export function classifyDamage(key: string, attack: number, magic: number): DamageType {
  const m = CHAMPION_META[key]
  if (m) return m.d
  if (attack === 0 && magic === 0) return 'Unknown'
  const diff = attack - magic
  if (diff >= 3) return 'AD'
  if (diff <= -3) return 'AP'
  return 'Mixed'
}

export function rolesOf(key: string, tags: string[]): string[] {
  const m = CHAMPION_META[key]
  if (m) return m.r
  // Rough fallback from Riot class tags.
  if (tags.includes('Marksman')) return ['bottom']
  if (tags.includes('Support')) return ['utility']
  if (tags.includes('Mage')) return ['middle']
  if (tags.includes('Assassin')) return ['middle', 'jungle']
  if (tags.includes('Tank')) return ['top', 'jungle']
  return ['top']
}

export function compTagsOf(key: string): string[] {
  return CHAMPION_META[key]?.t ?? []
}

// ---------------------------------------------------------------------------

export interface TeamAnalysis {
  picked: number
  ad: number
  ap: number
  mixed: number
  /** Estimated share of physical damage, 0..100 (Mixed counts half). */
  adPct: number
  /** One sharp sentence about the damage split. */
  damageVerdict: string
  /** What the composition is missing, most important first. */
  missing: string[]
  /** Tag counts for display. */
  tags: Record<string, number>
}

function count(champs: ChampionInfo[], tag: string): number {
  return champs.filter((c) => c.compTags.includes(tag)).length
}

export function analyzeTeam(input: (ChampionInfo | undefined)[]): TeamAnalysis {
  const champs = input.filter((c): c is ChampionInfo => !!c)
  const ad = champs.filter((c) => c.damageType === 'AD').length
  const ap = champs.filter((c) => c.damageType === 'AP').length
  const mixed = champs.filter((c) => c.damageType === 'Mixed').length
  const counted = ad + ap + mixed
  const adPct = counted ? Math.round(((ad + mixed * 0.5) / counted) * 100) : 50

  let damageVerdict = 'No picks yet'
  if (counted > 0) {
    if (ad >= 4) damageVerdict = `${ad} AD, one-dimensional. Armor shuts this team down.`
    else if (ap >= 4) damageVerdict = `${ap} AP, one-dimensional. MR shuts this team down.`
    else if (adPct >= 65) damageVerdict = `AD heavy (${adPct}% physical).`
    else if (adPct <= 35) damageVerdict = `AP heavy (${100 - adPct}% magic).`
    else damageVerdict = `Balanced (${adPct}% physical / ${100 - adPct}% magic).`
  }

  const tags: Record<string, number> = {}
  for (const c of champs) for (const t of c.compTags) tags[t] = (tags[t] ?? 0) + 1

  const missing: string[] = []
  if (champs.length >= 3) {
    if (count(champs, 'tank') === 0) missing.push('No frontline')
    if (count(champs, 'engage') === 0) missing.push('No engage')
    if (count(champs, 'peel') === 0 && count(champs, 'hypercarry') > 0) missing.push('Hypercarry with no peel')
    if (count(champs, 'cc') <= 1) missing.push('Very little CC')
    if (count(champs, 'dps') + count(champs, 'hypercarry') === 0 && champs.length >= 4) missing.push('No sustained DPS (all burst)')
  }

  return { picked: champs.length, ad, ap, mixed, adPct, damageVerdict, missing, tags }
}

/** Build advice against an enemy team. */
export function buildAdvice(enemy: (ChampionInfo | undefined)[]): string[] {
  const champs = enemy.filter((c): c is ChampionInfo => !!c)
  if (champs.length === 0) return []
  const a = analyzeTeam(champs)
  const out: string[] = []
  if (a.ad >= 4) out.push('Armor first and second item: they have almost no magic damage.')
  else if (a.ap >= 4) out.push('Magic resist first and second item: they have almost no physical damage.')
  else if (a.adPct >= 65) out.push('Armor first, MR later.')
  else if (a.adPct <= 35) out.push('MR first, armor later.')
  else out.push('Mixed damage: balanced resists or HP items.')

  const healers = champs.filter((c) => c.compTags.includes('sustain'))
  if (healers.length >= 2) out.push(`Anti-heal matters: ${healers.map((c) => c.name).join(', ')}.`)

  const tanks = champs.filter((c) => c.compTags.includes('tank'))
  if (tanks.length >= 2) out.push(`${tanks.length} tanks: %HP / armor pen items pay off.`)

  const assassins = champs.filter((c) => c.compTags.includes('assassin'))
  if (assassins.length >= 2) out.push(`${assassins.length} assassins: carries need an early defensive item (Zhonya's / GA / Steelcaps).`)

  const poke = count(champs, 'poke')
  if (poke >= 3) out.push('Heavy poke: fight early or force engage, do not siege into them.')

  return out
}

/** Pick advice for the local player given current picks. */
export function pickAdvice(
  myTeam: (ChampionInfo | undefined)[],
  enemy: (ChampionInfo | undefined)[],
  myLane: string
): string[] {
  const me = analyzeTeam(myTeam)
  const them = analyzeTeam(enemy)
  const out: string[] = []
  if (me.picked >= 2) {
    if (me.ap === 0 && me.ad >= 2) out.push('Team has no AP. An AP pick makes enemy itemisation much harder.')
    else if (me.ad === 0 && me.ap >= 2) out.push('Team has no AD. An AD pick makes enemy itemisation much harder.')
  }
  for (const m of me.missing) {
    if (m === 'No frontline' && (myLane === 'top' || myLane === 'jungle' || myLane === 'utility'))
      out.push('No frontline yet. A tank in your role fixes it.')
    if (m === 'No engage' && (myLane === 'jungle' || myLane === 'utility'))
      out.push('No engage yet. Pick something that starts fights.')
    if (m === 'Hypercarry with no peel' && myLane === 'utility') out.push('Carry needs peel: enchanter or peel support.')
  }
  if (them.picked >= 3) {
    if (them.ad >= 4) out.push('Enemy is full AD. Armor-stacking tanks and bruisers are very strong here.')
    if (them.ap >= 4) out.push('Enemy is full AP. MR scalers and spell shields are very strong here.')
    const assassins = count(enemy.filter((c): c is ChampionInfo => !!c), 'assassin')
    if (assassins >= 2 && (myLane === 'bottom' || myLane === 'middle')) out.push('Two+ enemy assassins. Favour self-peel and mobility.')
  }
  return out
}

/**
 * Assign enemy champions to lanes. Tries every permutation of the five lanes
 * and keeps the one where champions sit in their highest-priority roles.
 */
export function inferLanes(champs: (ChampionInfo | undefined)[]): (Lane | '')[] {
  const n = champs.length
  const idx = champs.map((_, i) => i).filter((i) => champs[i])
  if (idx.length === 0) return champs.map(() => '')

  const score = (c: ChampionInfo, lane: Lane): number => {
    const p = c.roles.indexOf(lane)
    if (p === 0) return 10
    if (p === 1) return 6
    if (p === 2) return 3
    if (p >= 3) return 1
    return -5
  }

  let best: { total: number; assign: Map<number, Lane> } = { total: -Infinity, assign: new Map() }
  const lanes = [...LANES]

  const permute = (arr: Lane[], k: number): void => {
    if (k === arr.length) {
      let total = 0
      const assign = new Map<number, Lane>()
      idx.forEach((ci, j) => {
        const lane = arr[j]
        assign.set(ci, lane)
        total += score(champs[ci]!, lane)
      })
      if (total > best.total) best = { total, assign }
      return
    }
    for (let i = k; i < arr.length; i++) {
      ;[arr[k], arr[i]] = [arr[i], arr[k]]
      permute(arr, k + 1)
      ;[arr[k], arr[i]] = [arr[i], arr[k]]
    }
  }
  permute(lanes, 0)

  return Array.from({ length: n }, (_, i) => best.assign.get(i) ?? '')
}

/** Short line for champ select chat. */
export function compositionChatLine(team: (ChampionInfo | undefined)[], enemy: (ChampionInfo | undefined)[]): string {
  const t = analyzeTeam(team)
  const e = analyzeTeam(enemy)
  const parts: string[] = []
  if (e.picked) {
    const res = e.ad >= 4 ? 'armor' : e.ap >= 4 ? 'MR' : e.adPct >= 65 ? 'armor > MR' : e.adPct <= 35 ? 'MR > armor' : 'mixed resists'
    parts.push(`Enemy ${e.ad} AD / ${e.ap} AP${e.mixed ? ` / ${e.mixed} mixed` : ''} -> ${res}`)
  }
  if (t.picked) parts.push(`Us ${t.ad} AD / ${t.ap} AP${t.mixed ? ` / ${t.mixed} mixed` : ''}`)
  return parts.join(' | ')
}
