import type { AppState, PlayerProfile, RankEntry } from '@shared/types'
import { averages, playerTraits } from '@shared/playerTraits'
import { Traits, kda, rankLabel, tierClass, winRate } from './PlayerCard'

const DD = 'https://ddragon.leagueoflegends.com/cdn'

export function RankBox({ title, r }: { title: string; r: RankEntry | null }) {
  return (
    <div className="rankbox">
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <div className={`rank big-rank ${tierClass(r)}`}>{rankLabel(r)}</div>
      {r && (
        <div className="muted mono">
          {r.wins}W {r.losses}L · {winRate(r.wins, r.losses)}%
        </div>
      )}
    </div>
  )
}

export function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`tile ${tone ?? ''}`}>
      <div className="tile-value mono">{value}</div>
      <div className="tile-label">{label}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  )
}

/** Profile header: icon, name, traits, rank boxes and the averages tiles. Used by lookup and home. */
export function ProfileHeader({ p, s }: { p: PlayerProfile; s: AppState }) {
  const a = averages(p.recent)
  const traits = playerTraits(p)
  const wins = p.recent.filter((g) => g.win).length
  return (
    <section className="team lookup-head">
      <div className="lookup-id">
        {s.ddragonVersion && p.iconId ? <img className="pfp" src={`${DD}/${s.ddragonVersion}/img/profileicon/${p.iconId}.png`} alt="" /> : <span className="pfp noimg" />}
        <div>
          <h2 className="lookup-name">{p.riotId}</h2>
          <div className="muted">Level {p.level}</div>
          <Traits traits={traits} />
        </div>
        <RankBox title="Solo / Duo" r={p.solo} />
        <RankBox title="Flex" r={p.flex} />
      </div>
      {a && (
        <div className="tiles">
          <Tile label={`Last ${p.recent.length} games`} value={`${wins}W ${p.recent.length - wins}L`} sub={`${winRate(wins, p.recent.length - wins)}% win rate`} tone={winRate(wins, p.recent.length - wins) >= 55 ? 'good' : winRate(wins, p.recent.length - wins) < 45 ? 'bad' : undefined} />
          <Tile label="KDA" value={kda(a.kills, a.deaths, a.assists)} sub={`${a.kills.toFixed(1)} / ${a.deaths.toFixed(1)} / ${a.assists.toFixed(1)}`} tone={a.deaths >= 7 ? 'bad' : a.deaths <= 3 ? 'good' : undefined} />
          <Tile label="Vision / min" value={a.visionPerMin.toFixed(2)} sub={`${Math.round(a.visionScore)} per game · ${a.controlWards.toFixed(1)} pinks`} tone={a.visionPerMin >= (a.supportShare >= 0.5 ? 2 : 1) ? 'good' : a.visionPerMin < (a.supportShare >= 0.5 ? 1.2 : 0.5) ? 'bad' : undefined} />
          <Tile label="CS / min" value={a.csPerMin.toFixed(1)} tone={a.supportShare >= 0.5 ? undefined : a.csPerMin >= 7.5 ? 'good' : a.csPerMin < 5 ? 'bad' : undefined} />
          <Tile label="Damage / min" value={Math.round(a.dmgPerMin).toLocaleString()} sub="to champions" />
          <Tile label="First blood" value={`${Math.round(a.firstBloodRate * 100)}%`} sub="of games involved" />
          <Tile label="Main role" value={Object.entries(a.lanes).sort((x, y) => y[1] - x[1])[0]?.[0]?.toLowerCase() ?? '-'} sub={`${Math.round(((Object.entries(a.lanes).sort((x, y) => y[1] - x[1])[0]?.[1] ?? 0) / a.games) * 100)}% of games`} />
        </div>
      )}
    </section>
  )
}

