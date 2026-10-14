import type { BuildEntry, ChampBuild, ChampionInfo } from '@shared/types'
import { BROWSER_HEADERS, extractQwikState, findObjects, makeResolver, num } from './qwik'
import { LANE_PARAM } from './lolalytics'

/**
 * Per-champion build from a Lolalytics build page. The page state holds
 * `{ items, runes, sums, skillorder, skillpriority }` objects (one per build
 * variant; the first is the most popular). Item, rune and summoner ids are
 * Riot ids, so Data Dragon resolves names and icons.
 */

/** Lolalytics URL slug for a champion. */
export function champSlug(c: ChampionInfo): string {
  const special: Record<string, string> = { MonkeyKing: 'wukong', Nunu: 'nunu', Renata: 'renata' }
  if (special[c.key]) return special[c.key]
  return c.name.toLowerCase().replace(/[^a-z]/g, '')
}

export function buildUrl(c: ChampionInfo, lane: string, tier = 'emerald_plus'): string {
  const q = new URLSearchParams({ lane: LANE_PARAM[lane] ?? lane, tier })
  return `https://lolalytics.com/lol/${champSlug(c)}/build/?${q.toString()}`
}

/** 1=Q 2=W 3=E 4=R, encoded as digits of a number. */
function decodeSkillOrder(id: unknown): string {
  const digits = String(id ?? '')
  const map: Record<string, string> = { '1': 'Q', '2': 'W', '3': 'E', '4': 'R' }
  return [...digits].map((d) => map[d] ?? '').join('')
}

function entries(v: unknown): BuildEntry[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => x as Record<string, unknown>)
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({ id: num(x.id), winRate: num(x.wr), games: num(x.n) }))
    .filter((x) => x.id > 0)
}

function ids(v: unknown): number[] {
  return Array.isArray(v) ? v.map(num).filter((n) => n > 0) : []
}

export function parseBuildHtml(championId: number, lane: string, html: string): ChampBuild {
  const state = extractQwikState(html)
  const resolve = makeResolver(state.objs)
  const blocks = findObjects(state.objs, ['items', 'runes', 'sums'])
  if (blocks.length === 0) throw new Error('lolalytics: no build block for this champion/lane')
  const b = resolve(blocks[0]) as Record<string, any>
  const items = b.items ?? {}
  const runes = b.runes ?? {}
  const sums = b.sums ?? {}
  return {
    championId,
    lane,
    patch: /Patch (\d+\.\d+)/.exec(html)?.[1] ?? '',
    fetchedAt: Date.now(),
    source: 'lolalytics',
    start: { ids: ids(items.start?.set), winRate: num(items.start?.wr), games: num(items.start?.n) },
    core: { ids: ids(items.core?.set), winRate: num(items.core?.wr), games: num(items.core?.n) },
    item4: entries(items.item4),
    item5: entries(items.item5),
    item6: entries(items.item6),
    runes: {
      primary: ids(runes.set?.pri),
      secondary: ids(runes.set?.sec),
      shards: ids(runes.set?.mod),
      winRate: num(runes.wr),
      games: num(runes.n)
    },
    summoners: { ids: ids(sums.ids), winRate: num(sums.wr), games: num(sums.n) },
    skillPriority: String(b.skillpriority?.id ?? ''),
    skillOrder: decodeSkillOrder(b.skillorder?.id)
  }
}

export async function fetchBuild(c: ChampionInfo, lane: string): Promise<ChampBuild> {
  const res = await fetch(buildUrl(c, lane), { headers: BROWSER_HEADERS })
  if (!res.ok) throw new Error(`lolalytics ${res.status}`)
  return parseBuildHtml(c.id, lane, await res.text())
}
