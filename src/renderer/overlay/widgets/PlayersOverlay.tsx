import type { AppState, LivePlayer } from '@shared/types'
import { champIcon } from '../../hooks/useAppState'
import { lanePairs, LANE_SHORT } from '../lanes'
import { rankLabel, recordFor, tierClass, winRate, Traits } from '../../control/PlayerCard'
import { averages, playerTraits } from '@shared/playerTraits'

/** Compact ten-player table for the loading screen: rank, win rate, record on this champion. */
export function PlayersOverlay({ s }: { s: AppState }) {
  const live = s.live!
  const pairs = lanePairs(live)
  const champOf = (p?: LivePlayer) =>
    p ? Object.values(s.champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', '')) : undefined

  const Row = ({ p, lane }: { p?: LivePlayer; lane: string }) => {
    if (!p) return <div className="po-row muted">—</div>
    const c = champOf(p)
    const prof = s.profiles[s.livePuuids[p.riotId] ?? '']
    const rec = c ? recordFor(prof, c.id) : undefined
    const recentWins = prof?.recent.filter((g) => g.win).length ?? 0
    const avg = prof ? averages(prof.recent) : null
    const traits = prof ? playerTraits(prof, lane) : []
    return (
      <div className="po-row">
        {c ? <img src={champIcon(c.key)} alt="" /> : <span className="noimg" />}
        <div style={{ minWidth: 0 }}>
          <div className="ellipsis" title={p.riotId}>
            {p.riotId}
          </div>
          <div className={`rank ${tierClass(prof?.solo ?? null)}`}>
            {prof ? rankLabel(prof.solo) : '…'}
            {avg && (
              <span className="muted mono" title="vision/min · deaths/game">
                {' '}
                · 👁{avg.visionPerMin.toFixed(1)} ☠{avg.deaths.toFixed(1)}
              </span>
            )}
          </div>
          <Traits traits={traits} max={3} />
        </div>
        <div className="mono po-stats">
          {prof && (
            <>
              <div title="last games">
                {recentWins}W {prof.recent.length - recentWins}L
              </div>
              <div title="on this champion">
                {rec && rec.games ? (
                  <b style={{ color: winRate(rec.wins, rec.games - rec.wins) >= 55 ? 'var(--ok)' : winRate(rec.wins, rec.games - rec.wins) < 45 ? 'var(--red)' : 'inherit' }}>
                    {winRate(rec.wins, rec.games - rec.wins)}% ·{rec.games}g
                  </b>
                ) : (
                  <span className="muted">new on champ</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="po">
      <div className="po-col">
        <div className="camp-head" style={{ color: 'var(--blue)' }}>
          Your team
        </div>
        {pairs.map((x) => (
          <div key={x.lane} className="po-lane">
            <span className="lane">{LANE_SHORT[x.lane]}</span>
            <Row p={x.ally} lane={x.lane} />
          </div>
        ))}
      </div>
      <div className="po-col">
        <div className="camp-head" style={{ color: 'var(--red)' }}>
          Enemy team
        </div>
        {pairs.map((x) => (
          <div key={x.lane} className="po-lane">
            <span className="lane">{LANE_SHORT[x.lane]}</span>
            <Row p={x.enemy} lane={x.lane} />
          </div>
        ))}
      </div>
    </div>
  )
}
