import type { ChampLaneStats } from '@shared/types'
import type { StatsProvider } from './provider'
import { BROWSER_HEADERS, extractQwikState, findObjects, makeResolver, num } from './qwik'

/**
 * Lolalytics tier list, decoded from the page's Qwik state (see qwik.ts).
 * Each table row is `{ cid: <ref>, row: <ref> }` where `row` resolves to
 * `{ wr, pr, br, games, lane, pctLane, defaultLane, rank, tier, ... }`.
 * Unofficial: `npm run probe:stats` shows what is decoded if it breaks.
 */

const BASE = 'https://lolalytics.com/lol/tierlist/'
export const LANE_PARAM: Record<string, string> = {
  top: 'top',
  jungle: 'jungle',
  middle: 'middle',
  bottom: 'bottom',
  utility: 'support'
}

export function buildUrl(lane: string, tier = 'emerald_plus'): string {
  const q = new URLSearchParams({ lane: LANE_PARAM[lane] ?? lane, tier })
  return `${BASE}?${q.toString()}`
}

export function parseTierListHtml(lane: string, html: string): { patch: string; rows: ChampLaneStats[] } {
  const state = extractQwikState(html)
  const resolve = makeResolver(state.objs)
  const rows: ChampLaneStats[] = []
  for (const o of findObjects(state.objs, ['row', 'cid'])) {
    const cid = num(resolve(o.cid))
    const row = resolve(o.row) as Record<string, unknown> | null
    if (!cid || !row || typeof row !== 'object' || !('wr' in row)) continue
    rows.push({
      championId: cid,
      lane,
      winRate: num(row.wr),
      pickRate: num(row.pr),
      banRate: num(row.br),
      games: num(row.games),
      lanePct: num(row.pctLane),
      defaultLane: typeof row.defaultLane === 'string' ? row.defaultLane : undefined
    })
  }
  if (rows.length === 0) throw new Error('lolalytics: no rows decoded (format changed?)')
  const patch = /Patch (\d+\.\d+)/.exec(html)?.[1] ?? ''
  return { patch, rows }
}

export const lolalytics: StatsProvider = {
  name: 'lolalytics',
  async fetchLane(lane) {
    const res = await fetch(buildUrl(lane), { headers: BROWSER_HEADERS })
    if (!res.ok) throw new Error(`lolalytics ${res.status}`)
    return parseTierListHtml(lane, await res.text())
  }
}
