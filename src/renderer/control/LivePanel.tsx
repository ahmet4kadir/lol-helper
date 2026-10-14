import type { AppState, LivePlayer } from '@shared/types'
import { PlayerCard } from './PlayerCard'
import { lanePairs, mySide, fmtTime } from '../overlay/lanes'

export { fmtTime }

/** Loading screen / in game: all ten players with rank and record on their champion. */
export function LivePanel({ s }: { s: AppState }) {
  const live = s.live!
  const side = mySide(live)
  const pairs = lanePairs(live)
  const champOf = (p?: LivePlayer) =>
    p ? Object.values(s.champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', '')) : undefined
  const profOf = (p?: LivePlayer) => (p ? s.profiles[s.livePuuids[p.riotId] ?? ''] : undefined)

  return (
    <div>
      <div className="cs-head">
        <h2>
          Live game <span className="muted">· {side === 'ORDER' ? 'blue side' : 'red side'}</span>
        </h2>
        <span className="muted mono">
          {fmtTime(live.gameTime)} · {live.gameMode}
        </span>
      </div>
      <div className="live-grid">
        <div className="live-col">
          <h2 className="col-title ally">Your team</h2>
          {pairs.map((p) => (
            <PlayerCard key={p.lane + 'a'} profile={profOf(p.ally)} champion={champOf(p.ally)} champions={s.champions} label={p.ally?.riotId} position={p.lane} />
          ))}
        </div>
        <div className="live-col">
          <h2 className="col-title enemy">Enemy team</h2>
          {pairs.map((p) => (
            <PlayerCard key={p.lane + 'e'} profile={profOf(p.enemy)} champion={champOf(p.enemy)} champions={s.champions} label={p.enemy?.riotId} position={p.lane} />
          ))}
        </div>
      </div>
    </div>
  )
}
