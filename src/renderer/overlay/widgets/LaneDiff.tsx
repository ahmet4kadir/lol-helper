import type { LiveSnapshot } from '@shared/types'
import { lanePairs, LANE_SHORT, sign, splitTeams } from '../lanes'

/** Level and CS lead lane by lane, more useful than a team average. */
export function LaneDiff({ live }: { live: LiveSnapshot }) {
  const pairs = lanePairs(live)
  const { ally, enemy } = splitTeams(live)
  const kills = (ps: typeof ally) => ps.reduce((a, p) => a + p.kills, 0)
  return (
    <div className="lanes">
      <div className="lanes-head">
        <span>Kills</span>
        <span className="mono">
          <b>{kills(ally)}</b> : <b>{kills(enemy)}</b>
        </span>
      </div>
      <div className="lanes-grid">
        <span className="muted">Lane</span>
        <span className="muted">Lvl</span>
        <span className="muted">CS</span>
        {pairs.map((p) => {
          const lv = (p.ally?.level ?? 0) - (p.enemy?.level ?? 0)
          const cs = (p.ally?.creepScore ?? 0) - (p.enemy?.creepScore ?? 0)
          const cls = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '')
          return (
            <div key={p.lane} className="lanes-row">
              <span className="lane">{LANE_SHORT[p.lane]}</span>
              <span className={`mono ${cls(lv)}`}>
                {p.ally?.level ?? '-'}
                <small> vs </small>
                {p.enemy?.level ?? '-'}
              </span>
              <span className={`mono ${cls(cs)}`}>
                {sign(cs)}
                {cs}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
