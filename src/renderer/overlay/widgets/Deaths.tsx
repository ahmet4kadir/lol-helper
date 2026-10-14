import type { ChampionDetail, ChampionInfo, ItemInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { champIcon } from '../../hooks/useAppState'
import { fmtTime, lanePairs, LANE_SHORT, mySide } from '../lanes'
import { travelTime } from './BaseTimer'

/**
 * Fully automatic: every dead player on either team, with respawn (from the
 * API) plus travel time to their own lane. Also shows how long the numbers
 * advantage lasts.
 */
export function Deaths({
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
  const side = mySide(live)
  const champOf = (p: LivePlayer) => Object.values(champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
  const rows: { p: LivePlayer; lane: string; ally: boolean }[] = []
  for (const pair of lanePairs(live)) {
    if (pair.ally?.isDead) rows.push({ p: pair.ally, lane: pair.lane, ally: true })
    if (pair.enemy?.isDead) rows.push({ p: pair.enemy, lane: pair.lane, ally: false })
  }
  // Players without a lane match (positions missing) still count.
  for (const p of live.players) if (p.isDead && !rows.some((r) => r.p.riotId === p.riotId)) rows.push({ p, lane: p.position || 'MIDDLE', ally: p.team === side })

  const allyAlive = live.players.filter((p) => p.team === side && !p.isDead).length
  const enemyAlive = live.players.filter((p) => p.team !== side && !p.isDead).length
  const deadEnemies = rows.filter((r) => !r.ally)
  const deadAllies = rows.filter((r) => r.ally)
  const nextEnemyUp = deadEnemies.length ? Math.min(...deadEnemies.map((r) => r.p.respawnTimer)) : 0
  const nextAllyUp = deadAllies.length ? Math.min(...deadAllies.map((r) => r.p.respawnTimer)) : 0

  if (rows.length === 0) return <div className="muted">Everyone alive</div>

  return (
    <div className="deaths">
      <div className={`deaths-head ${allyAlive > enemyAlive ? 'pos' : allyAlive < enemyAlive ? 'neg' : ''}`}>
        <span className="mono">
          {allyAlive}v{enemyAlive}
        </span>
        <span className="muted">
          {allyAlive > enemyAlive && nextEnemyUp > 0 && `advantage for ${fmtTime(nextEnemyUp)}`}
          {allyAlive < enemyAlive && nextAllyUp > 0 && `disadvantage for ${fmtTime(nextAllyUp)}`}
        </span>
      </div>
      {rows
        .sort((a, b) => a.p.respawnTimer - b.p.respawnTimer)
        .map(({ p, lane, ally }) => {
          const c = champOf(p)
          const d = c ? champDetails[c.id] : undefined
          const { travel } = travelTime(p, lane, d, items)
          const respawn = Math.max(0, Math.round(p.respawnTimer))
          return (
            <div key={p.riotId} className={`death-row ${ally ? 'ally' : 'enemy'}`}>
              <span className="lane">{LANE_SHORT[lane] ?? lane}</span>
              {c ? <img className="spell-champ" src={champIcon(c.key)} alt="" title={`${c.name} · ${p.riotId}`} /> : <span className="noimg" />}
              <span className="death-name ellipsis">{c?.name ?? p.riotId}</span>
              <span className="mono" title="respawn">
                ☠ {fmtTime(respawn)}
              </span>
              <span className="mono death-lane" title="respawn + travel to own lane">
                lane {fmtTime(respawn + travel)}
              </span>
            </div>
          )
        })}
    </div>
  )
}
