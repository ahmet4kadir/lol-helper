import type { ChampionInfo, ChampionRecord, PlayerProfile, PlayerTrait, RankEntry } from '@shared/types'
import { averages, playerTraits } from '@shared/playerTraits'
import { champIcon } from '../hooks/useAppState'

export function Traits({ traits, max }: { traits: PlayerTrait[]; max?: number }) {
  const list = max ? traits.slice(0, max) : traits
  if (list.length === 0) return null
  return (
    <div className="traits">
      {list.map((t) => (
        <span key={t.label} className={`trait ${t.tone}`} title={t.detail}>
          {t.label}
        </span>
      ))}
    </div>
  )
}

const TIER_SHORT: Record<string, string> = {
  IRON: 'Iron',
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Plat',
  EMERALD: 'Emerald',
  DIAMOND: 'Diamond',
  MASTER: 'Master',
  GRANDMASTER: 'GM',
  CHALLENGER: 'Chall'
}

export function rankLabel(r: RankEntry | null): string {
  if (!r) return 'Unranked'
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(r.tier)
  return `${TIER_SHORT[r.tier] ?? r.tier}${apex ? '' : ` ${r.division}`} ${r.lp} LP`
}

export function tierClass(r: RankEntry | null): string {
  return r ? `tier-${r.tier.toLowerCase()}` : 'tier-none'
}

export function winRate(w: number, l: number): number {
  return w + l ? Math.round((w / (w + l)) * 100) : 0
}

export function kda(k: number, d: number, a: number): string {
  return d === 0 ? 'Perfect' : ((k + a) / d).toFixed(1)
}

export function recordFor(p: PlayerProfile | undefined, championId: number): ChampionRecord | undefined {
  return p?.champions.find((c) => c.championId === championId)
}

/** One player: rank, overall recent form, and their record on a given champion. */
export function PlayerCard({
  profile,
  champion,
  champions,
  label,
  compact,
  position
}: {
  profile?: PlayerProfile
  champion?: ChampionInfo
  champions: Record<number, ChampionInfo>
  label?: string
  compact?: boolean
  /** Current lane (champ select assignedPosition or live position) for the off-role check. */
  position?: string
}) {
  if (!profile) {
    return (
      <div className="pcard">
        <div className="pcard-head">
          {champion ? <img src={champIcon(champion.key)} alt="" /> : <span className="noimg" />}
          <div>
            <div className="name">{label ?? '…'}</div>
            <div className="muted pos">Loading profile…</div>
          </div>
        </div>
      </div>
    )
  }
  const solo = profile.solo
  const recentWins = profile.recent.filter((g) => g.win).length
  const rec = champion ? recordFor(profile, champion.id) : undefined
  const streak = profile.recent.slice(0, 5)
  const avg = averages(profile.recent)
  const traits = playerTraits(profile, position)
  return (
    <div className="pcard">
      <div className="pcard-head">
        {champion ? <img src={champIcon(champion.key)} alt="" /> : <span className="noimg" />}
        <div style={{ minWidth: 0 }}>
          <div className="name ellipsis" title={profile.riotId}>
            {profile.riotId || label} <span className="muted">· {profile.level}</span>
          </div>
          <div className={`rank ${tierClass(solo)}`}>
            {rankLabel(solo)}
            {solo && (
              <span className="muted">
                {' '}
                · {winRate(solo.wins, solo.losses)}% ({solo.wins + solo.losses})
              </span>
            )}
          </div>
        </div>
      </div>

      {champion && (
        <div className="pcard-row">
          <span className="muted">On {champion.name}</span>
          {rec && rec.games > 0 ? (
            <span className="mono">
              <b style={{ color: winRate(rec.wins, rec.games - rec.wins) >= 55 ? 'var(--ok)' : winRate(rec.wins, rec.games - rec.wins) < 45 ? 'var(--red)' : 'inherit' }}>
                {winRate(rec.wins, rec.games - rec.wins)}%
              </b>{' '}
              · {rec.games}g · {kda(rec.kills, rec.deaths, rec.assists)} KDA
            </span>
          ) : rec?.masteryPoints ? (
            <span className="mono muted">M{rec.masteryLevel} · {Math.round(rec.masteryPoints / 1000)}k</span>
          ) : (
            <span className="muted warn-text">no recent games</span>
          )}
        </div>
      )}

      <div className="pcard-row">
        <span className="muted">Last {profile.recent.length}</span>
        <span className="mono">
          {recentWins}W {profile.recent.length - recentWins}L
          <span className="streak">
            {streak.map((g, i) => (
              <i key={i} className={g.win ? 'w' : 'l'} />
            ))}
          </span>
        </span>
      </div>

      {avg && (
        <div className="pcard-row">
          <span className="muted">Avg</span>
          <span className="mono" title="vision score per minute · vision score per game · deaths per game">
            👁 {avg.visionPerMin.toFixed(2)}/min ({Math.round(avg.visionScore)}) · ☠ {avg.deaths.toFixed(1)}
          </span>
        </div>
      )}

      <Traits traits={traits} max={compact ? 3 : undefined} />

      {!compact && (
        <div className="pcard-champs">
          {profile.champions.slice(0, 4).map((c) => {
            const ci = champions[c.championId]
            return ci ? (
              <div key={c.championId} className="pcard-champ" title={`${ci.name}: ${c.wins}W ${c.games - c.wins}L`}>
                <img src={champIcon(ci.key)} alt="" />
                <span className="mono">{c.games ? `${winRate(c.wins, c.games - c.wins)}%` : `M${c.masteryLevel ?? ''}`}</span>
              </div>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}
