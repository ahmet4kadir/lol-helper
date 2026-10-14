import { useEffect, useState } from 'react'
import type { ChampionDetail, ChampionInfo, ItemInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { BOOTS_MS, HOMEGUARD_DECAY_SEC, HOMEGUARD_PCT, LANE_DISTANCE, RECALL_SEC } from '@shared/gameConstants'
import { champIcon } from '../../hooks/useAppState'
import { fmtTime, lanePairs, LANE_SHORT } from '../lanes'

/**
 * Out-of-combat move speed: (base + flat from boots) × (1 + Σ percent from items).
 * Flat and percent values come from Data Dragon item stats; boots are unique so
 * only the biggest flat bonus counts. Passives described only in item text
 * (e.g. Dead Man's Plate stacks) are not visible to the API and are ignored.
 */
export function moveSpeed(p: LivePlayer, d: ChampionDetail | undefined, items: Record<number, ItemInfo>): number {
  const base = d?.moveSpeed ?? 340
  let flat = 0
  let pct = 0
  for (const it of p.items) {
    const info = items[it.itemID]
    flat = Math.max(flat, info?.msFlat ?? BOOTS_MS[it.itemID] ?? 0)
    pct += (info?.msPct ?? 0) * it.count
  }
  return Math.round((base + flat) * (1 + pct))
}

/** Seconds from "starts recalling" to "back in lane" for this enemy. */
export function travelTime(
  p: LivePlayer,
  lane: string,
  d: ChampionDetail | undefined,
  items: Record<number, ItemInfo>
): { recall: number; travel: number; ms: number } {
  const dist = LANE_DISTANCE[lane] ?? LANE_DISTANCE.MIDDLE
  const ms = moveSpeed(p, d, items)
  // Homeguard: during the decay window average bonus is HOMEGUARD_PCT / 2.
  const homeguardDist = ms * HOMEGUARD_DECAY_SEC * (1 + HOMEGUARD_PCT / 2)
  let travel: number
  if (dist <= homeguardDist) {
    // Never leaves the boosted window (not realistic for any lane, but keep the math honest).
    travel = (dist / ms) / (1 + HOMEGUARD_PCT / 2)
  } else {
    travel = HOMEGUARD_DECAY_SEC + (dist - homeguardDist) / ms
  }
  return { recall: RECALL_SEC, travel: Math.max(5, Math.round(travel)), ms }
}

/**
 * Base-to-lane timer: click "Recall" when an enemy starts recalling, "At base"
 * if they are already there (died / you saw them in fountain). Travel time
 * comes from the champion's base move speed plus their boots.
 */
export function BaseTimer({
  live,
  champions,
  champDetails,
  items
}: {
  live: LiveSnapshot
  champions: Record<number, ChampionInfo>
  champDetails: Record<number, ChampionDetail>
  items: Record<number, ItemInfo>
}) {
  const [ends, setEnds] = useState<Record<string, number>>({})
  const [lastT, setLastT] = useState(live.gameTime)
  const t = live.gameTime

  useEffect(() => {
    if (t < lastT - 5) setEnds({})
    setLastT(t)
  }, [t, lastT])

  const champOf = (p: LivePlayer) => Object.values(champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
  const enemies = lanePairs(live)
    .map((x) => ({ lane: x.lane, p: x.enemy }))
    .filter((x): x is { lane: string; p: LivePlayer } => !!x.p)

  return (
    <div className="base">
      {enemies.map(({ lane, p }) => {
        const c = champOf(p)
        const d = c ? champDetails[c.id] : undefined
        const { recall, travel, ms } = travelTime(p, lane, d, items)
        const end = ends[p.riotId]
        const left = end !== undefined ? end - t : undefined
        // Dead enemies: respawn timer + travel is the real answer.
        const deadLeft = p.isDead ? Math.round(p.respawnTimer) + travel : undefined
        return (
          <div key={p.riotId} className="base-row">
            <span className="lane">{LANE_SHORT[lane]}</span>
            {c ? <img className="spell-champ" src={champIcon(c.key)} alt="" title={`${c.name} · ${ms} MS`} /> : <span className="noimg" />}
            <span className="muted mono" style={{ fontSize: 10, width: 30 }}>
              {ms}
            </span>
            <button className="camp" onClick={() => setEnds((e) => ({ ...e, [p.riotId]: t + recall + travel }))} title={`${recall}s recall + ${travel}s travel`}>
              Recall
            </button>
            <button className="camp" onClick={() => setEnds((e) => ({ ...e, [p.riotId]: t + travel }))} title={`${travel}s travel`}>
              At base
            </button>
            <span className={`mono base-time ${left !== undefined && left > 0 ? (left <= 5 ? 'soon' : 'running') : ''}`}>
              {deadLeft !== undefined ? (
                <span title="dead: respawn + travel">☠ {fmtTime(deadLeft)}</span>
              ) : left !== undefined && left > 0 ? (
                fmtTime(left)
              ) : left !== undefined ? (
                'IN LANE'
              ) : (
                `${recall + travel}s`
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
