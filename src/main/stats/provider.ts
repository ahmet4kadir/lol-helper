import { readFile, writeFile, mkdir } from 'fs/promises'
import { cacheDir } from '../cacheDir'
import { join } from 'path'
import type { ChampLaneStats, MetaStats } from '@shared/types'
import { LANES } from '@shared/analysis'
import { lolalytics } from './lolalytics'

/**
 * A stats provider returns per-champion win/pick/ban rates for one lane.
 * Riot does not publish this; providers wrap community sites' unofficial
 * endpoints, so each one is isolated behind this interface and may break.
 */
export interface StatsProvider {
  name: string
  fetchLane(lane: string): Promise<{ patch: string; rows: ChampLaneStats[] }>
}

const PROVIDERS: StatsProvider[] = [lolalytics]
const TTL = 6 * 60 * 60 * 1000

function cachePath(): string {
  return join(cacheDir(), 'meta-stats.json')
}

export async function loadMeta(force = false): Promise<MetaStats> {
  if (!force) {
    try {
      const cached = JSON.parse(await readFile(cachePath(), 'utf8')) as MetaStats
      if (Date.now() - cached.fetchedAt < TTL) return cached
    } catch {
      /* no cache */
    }
  }
  let lastErr: unknown = new Error('no providers')
  for (const p of PROVIDERS) {
    try {
      const byLane: Record<string, ChampLaneStats[]> = {}
      let patch = ''
      for (const lane of LANES) {
        const r = await p.fetchLane(lane)
        patch = r.patch || patch
        byLane[lane] = r.rows.sort((a, b) => b.winRate - a.winRate)
      }
      const meta: MetaStats = { patch, fetchedAt: Date.now(), source: p.name, byLane }
      await mkdir(cacheDir(), { recursive: true })
      await writeFile(cachePath(), JSON.stringify(meta))
      return meta
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}
