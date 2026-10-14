import { readFile, writeFile, mkdir } from 'fs/promises'
import { cacheDir } from '../cacheDir'
import { join } from 'path'
import type { ChampionDetail, ChampionInfo, ItemInfo, RuneInfo } from '@shared/types'
import { classifyDamage, rolesOf, compTagsOf } from '@shared/analysis'

/**
 * Static game data from Riot's Data Dragon CDN (champions, items, runes),
 * cached on disk so the app works offline after the first run.
 */

const DDRAGON = 'https://ddragon.leagueoflegends.com'

export interface StaticData {
  version: string
  fetchedAt: number
  schema?: number
  champions: Record<number, ChampionInfo>
  items: Record<number, ItemInfo>
  runes: Record<number, RuneInfo>
}

/** Bump when the shape changes so stale caches are refetched. */
const SCHEMA = 4
const ONE_DAY = 24 * 60 * 60 * 1000

function cachePath(): string {
  return join(cacheDir(), 'ddragon.json')
}

async function readCache(): Promise<StaticData | null> {
  try {
    const c = JSON.parse(await readFile(cachePath(), 'utf8')) as StaticData
    return c.schema === SCHEMA ? c : null
  } catch {
    return null
  }
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return (await r.json()) as T
}

async function fetchLatest(): Promise<StaticData> {
  const versions = await getJson<string[]>(`${DDRAGON}/api/versions.json`)
  const version = versions[0]
  const base = `${DDRAGON}/cdn/${version}/data/en_US`

  const champData = await getJson<{
    data: Record<string, { key: string; id: string; name: string; tags: string[]; info: { attack: number; magic: number } }>
  }>(`${base}/champion.json`)
  const champions: Record<number, ChampionInfo> = {}
  for (const c of Object.values(champData.data)) {
    const id = Number(c.key)
    champions[id] = {
      id,
      key: c.id,
      name: c.name,
      tags: c.tags,
      attack: c.info.attack,
      magic: c.info.magic,
      damageType: classifyDamage(c.id, c.info.attack, c.info.magic),
      roles: rolesOf(c.id, c.tags),
      compTags: compTagsOf(c.id)
    }
  }

  const itemData = await getJson<{
    data: Record<string, { name: string; gold: { total: number }; stats?: Record<string, number> }>
  }>(`${base}/item.json`)
  const items: Record<number, ItemInfo> = {}
  for (const [id, it] of Object.entries(itemData.data))
    items[Number(id)] = {
      id: Number(id),
      name: it.name,
      gold: it.gold?.total ?? 0,
      msFlat: it.stats?.FlatMovementSpeedMod ?? 0,
      msPct: it.stats?.PercentMovementSpeedMod ?? 0
    }

  const runeData = await getJson<{ id: number; slots: { runes: { id: number; name: string; icon: string }[] }[] }[]>(
    `${base}/runesReforged.json`
  )
  const runes: Record<number, RuneInfo> = {}
  for (const style of runeData)
    for (const slot of style.slots) for (const r of slot.runes) runes[r.id] = { id: r.id, name: r.name, icon: r.icon, style: style.id }
  // Stat shards are not in runesReforged.json.
  const shards: [number, string, string][] = [
    [5008, 'Adaptive Force', 'perk-images/StatMods/StatModsAdaptiveForceIcon.png'],
    [5005, 'Attack Speed', 'perk-images/StatMods/StatModsAttackSpeedIcon.png'],
    [5007, 'Ability Haste', 'perk-images/StatMods/StatModsCDRScalingIcon.png'],
    [5001, 'Health Scaling', 'perk-images/StatMods/StatModsHealthScalingIcon.png'],
    [5002, 'Armor', 'perk-images/StatMods/StatModsArmorIcon.png'],
    [5003, 'Magic Resist', 'perk-images/StatMods/StatModsMagicResIcon.MagicResist_Fix.png'],
    [5010, 'Move Speed', 'perk-images/StatMods/StatModsMovementSpeedIcon.png'],
    [5011, 'Health', 'perk-images/StatMods/StatModsHealthPlusIcon.png'],
    [5013, 'Tenacity & Slow Resist', 'perk-images/StatMods/StatModsTenacityIcon.png']
  ]
  for (const [id, name, icon] of shards) runes[id] = { id, name, icon, style: 0 }

  return { version, fetchedAt: Date.now(), schema: SCHEMA, champions, items, runes }
}

/** Per-champion detail (base move speed, ultimate cooldowns) fetched lazily and cached on disk. */
const detailCache = new Map<number, ChampionDetail>()

export async function loadChampionDetail(version: string, champ: ChampionInfo): Promise<ChampionDetail> {
  const hit = detailCache.get(champ.id)
  if (hit) return hit
  const file = join(cacheDir(), 'champ-details', `${version}-${champ.key}.json`)
  try {
    const d = JSON.parse(await readFile(file, 'utf8')) as ChampionDetail
    detailCache.set(champ.id, d)
    return d
  } catch {
    /* fetch */
  }
  const data = await getJson<{ data: Record<string, { stats: { movespeed: number }; spells: { name: string; cooldown: number[] }[] }> }>(
    `${DDRAGON}/cdn/${version}/data/en_US/champion/${champ.key}.json`
  )
  const c = data.data[champ.key]
  const ult = c.spells[3]
  const detail: ChampionDetail = {
    id: champ.id,
    moveSpeed: c.stats.movespeed,
    ultCooldown: ult?.cooldown ?? [],
    ultName: ult?.name ?? ''
  }
  detailCache.set(champ.id, detail)
  try {
    await mkdir(join(cacheDir(), 'champ-details'), { recursive: true })
    await writeFile(file, JSON.stringify(detail))
  } catch {
    /* cache is best effort */
  }
  return detail
}

export async function loadStaticData(): Promise<StaticData> {
  const cached = await readCache()
  if (cached && Date.now() - cached.fetchedAt < ONE_DAY) return cached
  try {
    const fresh = await fetchLatest()
    await mkdir(cacheDir(), { recursive: true })
    await writeFile(cachePath(), JSON.stringify(fresh))
    return fresh
  } catch (e) {
    if (cached) return cached
    throw e
  }
}
