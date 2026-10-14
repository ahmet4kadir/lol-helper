import type { LiveSnapshot } from '@shared/types'
import { itemGold, lanePairs, LANE_SHORT, sign } from '../lanes'
import { champIcon } from '../../hooks/useAppState'

function key(raw: string): string {
  return raw.replace('game_character_displayname_', '')
}

/**
 * Gold difference, meant to sit next to the Tab scoreboard. Enemy unspent gold
 * is not exposed by the API, so everything here is item value: what has
 * actually been bought. Team total first, then lane by lane.
 */
export function GoldDiff({ live }: { live: LiveSnapshot }) {
  const pairs = lanePairs(live)
  const allyTotal = pairs.reduce((a, p) => a + (p.ally ? itemGold(p.ally) : 0), 0)
  const enemyTotal = pairs.reduce((a, p) => a + (p.enemy ? itemGold(p.enemy) : 0), 0)
  const teamDiff = allyTotal - enemyTotal
  return (
    <div className="gold">
      <div className={`gold-team ${teamDiff >= 0 ? 'pos' : 'neg'}`}>
        <span className="muted">Team items</span>
        <span className="big mono">
          {sign(teamDiff)}
          {teamDiff.toLocaleString()}
        </span>
        <span className="muted mono">
          {allyTotal.toLocaleString()} vs {enemyTotal.toLocaleString()}
        </span>
      </div>
      {pairs.map((p) => {
        const a = p.ally ? itemGold(p.ally) : 0
        const e = p.enemy ? itemGold(p.enemy) : 0
        const d = a - e
        return (
          <div key={p.lane} className="gold-row">
            <span className="lane">{LANE_SHORT[p.lane]}</span>
            {p.ally ? <img src={champIcon(key(p.ally.rawChampionName))} alt="" /> : <span className="noimg" />}
            <span className="mono">{a.toLocaleString()}</span>
            <span className={`mono diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}`}>
              {sign(d)}
              {d.toLocaleString()}
            </span>
            <span className="mono">{e.toLocaleString()}</span>
            {p.enemy ? <img src={champIcon(key(p.enemy.rawChampionName))} alt="" /> : <span className="noimg" />}
          </div>
        )
      })}
    </div>
  )
}
