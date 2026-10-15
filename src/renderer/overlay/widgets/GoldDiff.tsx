import type { LiveSnapshot } from '@shared/types'
import { itemGold, lanePairs, sign } from '../lanes'

/**
 * Gold difference laid out to sit in the middle column of the Tab scoreboard:
 * five evenly spaced rows (one per lane pair, same order as the scoreboard)
 * and the team total above. Resize the box in edit mode so the rows line up
 * with the scoreboard rows. Enemy unspent gold is not exposed by the API, so
 * all figures are item value.
 */
export function GoldDiff({ live, editMode }: { live: LiveSnapshot; editMode: boolean }) {
  const pairs = lanePairs(live)
  const allyTotal = pairs.reduce((a, p) => a + (p.ally ? itemGold(p.ally) : 0), 0)
  const enemyTotal = pairs.reduce((a, p) => a + (p.enemy ? itemGold(p.enemy) : 0), 0)
  const teamDiff = allyTotal - enemyTotal
  const k = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
  return (
    <div className={`goldsb ${editMode ? 'calibrating' : ''}`}>
      <div className={`goldsb-total mono ${teamDiff >= 0 ? 'pos' : 'neg'}`} title={`${allyTotal.toLocaleString()} vs ${enemyTotal.toLocaleString()} item gold`}>
        {sign(teamDiff)}
        {k(teamDiff)}
      </div>
      <div className="goldsb-rows">
        {pairs.map((p) => {
          const a = p.ally ? itemGold(p.ally) : 0
          const e = p.enemy ? itemGold(p.enemy) : 0
          const d = a - e
          return (
            <div key={p.lane} className="goldsb-row mono" title={`${a.toLocaleString()} vs ${e.toLocaleString()}`}>
              <span className={`diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}`}>
                {sign(d)}
                {k(d)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
