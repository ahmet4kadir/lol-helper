import type { ChampionInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { champIcon } from '../../hooks/useAppState'
import { fmtTime, LANE_SHORT, mySide } from '../lanes'
import type { ReturnInfo } from '../useReturnTimers'

/**
 * Fully automatic: everyone who is dead or on their way back to lane, with
 * respawn and arrival countdowns, plus how long the numbers advantage lasts.
 */
export function Deaths({ live, champions, info }: { live: LiveSnapshot; champions: Record<number, ChampionInfo>; info: Record<string, ReturnInfo> }) {
  const side = mySide(live)
  const champOf = (p: LivePlayer) => Object.values(champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
  const rows = live.players.filter((p) => info[p.riotId]).map((p) => ({ p, r: info[p.riotId], ally: p.team === side }))

  const allyAlive = live.players.filter((p) => p.team === side && !p.isDead).length
  const enemyAlive = live.players.filter((p) => p.team !== side && !p.isDead).length
  const nextEnemyUp = Math.min(...rows.filter((x) => !x.ally && x.r.dead).map((x) => x.r.respawnIn), Infinity)
  const nextAllyUp = Math.min(...rows.filter((x) => x.ally && x.r.dead).map((x) => x.r.respawnIn), Infinity)

  if (rows.length === 0) return <div className="muted">Everyone alive and in lane</div>

  return (
    <div className="deaths">
      <div className={`deaths-head ${allyAlive > enemyAlive ? 'pos' : allyAlive < enemyAlive ? 'neg' : ''}`}>
        <span className="mono">
          {allyAlive}v{enemyAlive}
        </span>
        <span className="muted">
          {allyAlive > enemyAlive && Number.isFinite(nextEnemyUp) && `advantage for ${fmtTime(nextEnemyUp)}`}
          {allyAlive < enemyAlive && Number.isFinite(nextAllyUp) && `disadvantage for ${fmtTime(nextAllyUp)}`}
        </span>
      </div>
      {rows
        .sort((a, b) => a.r.laneIn - b.r.laneIn)
        .map(({ p, r, ally }) => {
          const c = champOf(p)
          return (
            <div key={p.riotId} className={`death-row ${ally ? 'ally' : 'enemy'}`}>
              <span className="lane">{LANE_SHORT[r.lane] ?? r.lane}</span>
              {c ? <img className="spell-champ" src={champIcon(c.key)} alt="" title={`${c.name} · ${p.riotId}`} /> : <span className="noimg" />}
              <span className="death-name ellipsis">{c?.name ?? p.riotId}</span>
              <span className="mono" title={r.dead ? 'respawn' : 'alive, travelling'}>
                {r.dead ? `☠ ${fmtTime(r.respawnIn)}` : '→ lane'}
              </span>
              <span className="mono death-lane" title="back in lane">
                {fmtTime(r.laneIn)}
              </span>
            </div>
          )
        })}
    </div>
  )
}
