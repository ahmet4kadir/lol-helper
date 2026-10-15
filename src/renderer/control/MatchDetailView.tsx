import type { ChampionInfo, ItemInfo, MatchDetail, MatchParticipant } from '@shared/types'
import { champIcon } from '../hooks/useAppState'
import { kda } from './PlayerCard'

const DD = 'https://ddragon.leagueoflegends.com/cdn'
const SPELL_KEY: Record<number, string> = {
  1: 'SummonerBoost',
  3: 'SummonerExhaust',
  4: 'SummonerFlash',
  6: 'SummonerHaste',
  7: 'SummonerHeal',
  11: 'SummonerSmite',
  12: 'SummonerTeleport',
  14: 'SummonerDot',
  21: 'SummonerBarrier'
}
const LANE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT']

function laneKey(p: MatchParticipant): string {
  if (p.role === 'DUO_SUPPORT') return 'SUPPORT'
  if (p.role === 'DUO_CARRY') return 'BOTTOM'
  return p.lane
}

function sortByLane(ps: MatchParticipant[]): MatchParticipant[] {
  return [...ps].sort((a, b) => {
    const ia = LANE_ORDER.indexOf(laneKey(a))
    const ib = LANE_ORDER.indexOf(laneKey(b))
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib)
  })
}

export function fmtDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`
}

/** Full scoreboard of one game: both teams, items, damage bars, objectives. */
export function MatchDetailView({
  match,
  focusPuuid,
  champions,
  items,
  version
}: {
  match: MatchDetail
  focusPuuid: string
  champions: Record<number, ChampionInfo>
  items: Record<number, ItemInfo>
  version: string
}) {
  const all = match.teams.flatMap((t) => t.participants)
  const maxDmg = Math.max(1, ...all.map((p) => p.damageToChamps))
  const minutes = Math.max(1, match.durationSec / 60)

  const Row = ({ p }: { p: MatchParticipant }) => {
    const c = champions[p.championId]
    return (
      <div className={`md-row ${p.puuid === focusPuuid ? 'focus' : ''}`}>
        <div className="md-champ">
          {c ? <img src={champIcon(c.key)} alt="" title={c.name} /> : <span className="noimg" />}
          <span className="md-level">{p.level}</span>
        </div>
        <div className="md-spells">
          {[p.spell1Id, p.spell2Id].map((id, i) =>
            SPELL_KEY[id] && version ? <img key={i} src={`${DD}/${version}/img/spell/${SPELL_KEY[id]}.png`} alt="" /> : <span key={i} className="noimg" />
          )}
        </div>
        <div className="md-name">
          <div className="ellipsis" title={p.riotId}>
            {p.riotId || '?'}
          </div>
          <div className="muted">{c?.name ?? p.championId}</div>
        </div>
        <div className="md-kda mono">
          <div>
            <b>{p.kills}</b> / <b style={{ color: 'var(--red)' }}>{p.deaths}</b> / <b>{p.assists}</b>
          </div>
          <div className="muted">{kda(p.kills, p.deaths, p.assists)} KDA</div>
        </div>
        <div className="md-dmg">
          <div className="md-bar">
            <div style={{ width: `${(p.damageToChamps / maxDmg) * 100}%` }} />
          </div>
          <div className="mono muted">{(p.damageToChamps / 1000).toFixed(1)}k dmg</div>
        </div>
        <div className="md-stat mono">
          <div>{p.cs} cs</div>
          <div className="muted">{(p.cs / minutes).toFixed(1)}/min</div>
        </div>
        <div className="md-stat mono">
          <div>{(p.gold / 1000).toFixed(1)}k</div>
          <div className="muted">gold</div>
        </div>
        <div className="md-stat mono">
          <div>{p.visionScore}</div>
          <div className="muted">vision · {p.controlWards} pink</div>
        </div>
        <div className="md-items">
          {p.items.map((id, i) =>
            id ? (
              <img key={i} src={`${DD}/${version}/img/item/${id}.png`} alt="" title={items[id]?.name ?? String(id)} />
            ) : (
              <span key={i} className="md-empty" />
            )
          )}
          {p.trinket ? <img className="trinket" src={`${DD}/${version}/img/item/${p.trinket}.png`} alt="" title={items[p.trinket]?.name ?? ''} /> : <span className="md-empty trinket" />}
        </div>
      </div>
    )
  }

  return (
    <div className="md">
      {match.teams.map((t) => (
        <div key={t.teamId} className={`md-team ${t.win ? 'win' : 'loss'}`}>
          <div className="md-head">
            <span className={`md-result ${t.win ? 'win' : 'loss'}`}>{t.win ? 'Victory' : 'Defeat'}</span>
            <span className="muted">{t.teamId === 100 ? 'Blue side' : 'Red side'}</span>
            <span className="mono">
              {t.kills} kills · {(t.gold / 1000).toFixed(1)}k gold
            </span>
            <span className="mono muted">
              🗼 {t.towers} · 🐉 {t.dragons} · 🪱 {t.grubs} · 👁 {t.heralds} · 🟣 {t.barons}
            </span>
            {t.bans.length > 0 && (
              <span className="md-bans">
                <span className="muted">bans</span>
                {t.bans.map((id, i) => {
                  const c = champions[id]
                  return c ? <img key={i} src={champIcon(c.key)} alt="" title={c.name} /> : null
                })}
              </span>
            )}
          </div>
          {sortByLane(t.participants).map((p) => (
            <Row key={p.puuid || p.riotId} p={p} />
          ))}
        </div>
      ))}
    </div>
  )
}
