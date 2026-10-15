import { useState } from 'react'
import type { AppState, MatchDetail, PlayerProfile, RankEntry } from '@shared/types'
import { averages, playerTraits } from '@shared/playerTraits'
import { Traits, kda, rankLabel, tierClass, winRate } from './PlayerCard'
import { MatchDetailView, fmtDuration } from './MatchDetailView'
import { champIcon } from '../hooks/useAppState'

const DD = 'https://ddragon.leagueoflegends.com/cdn'
const QUEUE: Record<number, string> = { 420: 'Ranked Solo', 440: 'Ranked Flex', 400: 'Normal', 430: 'Blind', 450: 'ARAM', 490: 'Quickplay', 1700: 'Arena' }

function ago(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

function RankBox({ title, r }: { title: string; r: RankEntry | null }) {
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

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`tile ${tone ?? ''}`}>
      <div className="tile-value mono">{value}</div>
      <div className="tile-label">{label}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  )
}

function Header({ p, s }: { p: PlayerProfile; s: AppState }) {
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

/** Search any player by Riot ID: rank, averages, traits, champion pool, and expandable games. */
export function LookupPanel({ s }: { s: AppState }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [puuid, setPuuid] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [matches, setMatches] = useState<Record<number, MatchDetail | 'loading' | 'error'>>({})
  const profile = puuid ? s.profiles[puuid] : undefined

  const go = async () => {
    if (!q.trim()) return
    setBusy(true)
    setErr(null)
    setOpen(null)
    const r = await window.helper.lookupPlayer(q.trim())
    setBusy(false)
    if (r.ok && r.puuid) setPuuid(r.puuid)
    else setErr(r.error ?? 'Lookup failed')
  }

  const toggleGame = async (gameId: number) => {
    if (open === gameId) {
      setOpen(null)
      return
    }
    setOpen(gameId)
    if (matches[gameId]) return
    setMatches((m) => ({ ...m, [gameId]: 'loading' }))
    const r = await window.helper.getMatch(gameId)
    setMatches((m) => ({ ...m, [gameId]: r.ok && r.match ? r.match : 'error' }))
  }

  const maxGames = profile ? Math.max(1, ...profile.champions.map((c) => c.games)) : 1

  return (
    <div className="lookup">
      <div className="lookup-bar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="Name#TAG"
          disabled={!s.lcuConnected && !s.mock}
        />
        <button className="primary" onClick={go} disabled={busy || (!s.lcuConnected && !s.mock)}>
          {busy ? 'Searching…' : 'Search'}
        </button>
        {!s.lcuConnected && !s.mock && <span className="muted">Needs the League client running, lookups go through it.</span>}
        {err && <span className="warn-text">{err}</span>}
      </div>

      {profile && (
        <>
          <Header p={profile} s={s} />

          <div className="lookup-grid">
            <section className="team">
              <h2>Champion pool</h2>
              {profile.champions.slice(0, 12).map((c) => {
                const ci = s.champions[c.championId]
                if (!ci) return null
                const wr = c.games ? winRate(c.wins, c.games - c.wins) : 0
                return (
                  <div key={c.championId} className="pool-row">
                    <img src={champIcon(ci.key)} alt="" />
                    <div className="pool-main">
                      <div className="pool-top">
                        <span className="name">{ci.name}</span>
                        <span className="mono muted">
                          {c.games ? `${c.wins}W ${c.games - c.wins}L · ${kda(c.kills, c.deaths, c.assists)} KDA` : 'mastery only'}
                          {c.masteryPoints ? ` · M${c.masteryLevel} ${Math.round(c.masteryPoints / 1000)}k` : ''}
                        </span>
                      </div>
                      <div className="pool-bar">
                        <div className="pool-games" style={{ width: `${(c.games / maxGames) * 100}%` }}>
                          <div className="pool-wins" style={{ width: `${wr}%` }} />
                        </div>
                      </div>
                    </div>
                    <span className={`mono pool-wr ${c.games ? (wr >= 55 ? 'pos' : wr < 45 ? 'neg' : '') : 'muted'}`}>{c.games ? `${wr}%` : '-'}</span>
                  </div>
                )
              })}
            </section>

            <section className="team">
              <h2>Recent games <span className="muted">· click to open</span></h2>
              {profile.recent.map((g) => {
                const ci = s.champions[g.championId]
                const isOpen = open === g.gameId
                const m = matches[g.gameId]
                return (
                  <div key={g.gameId} className={`game-wrap ${isOpen ? 'open' : ''}`}>
                    <div className={`game ${g.win ? 'win' : 'loss'}`} onClick={() => toggleGame(g.gameId)}>
                      {ci ? <img src={champIcon(ci.key)} alt="" /> : <span className="noimg" />}
                      <div>
                        <div className="name">
                          {ci?.name ?? g.championId} <span className="muted">· {QUEUE[g.queueId] ?? g.queueId}</span>
                        </div>
                        <div className="pos">
                          <b>
                            {g.kills}/{g.deaths}/{g.assists}
                          </b>{' '}
                          · {g.cs} cs · {g.visionScore} vision · {fmtDuration(g.durationSec)}
                        </div>
                      </div>
                      <div className="game-right mono">
                        <div className={g.win ? 'pos' : 'neg'}>{g.win ? 'WIN' : 'LOSS'}</div>
                        <div className="muted">{ago(g.createdAt)}</div>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="game-detail">
                        {m === 'loading' || !m ? (
                          <div className="muted">Loading scoreboard…</div>
                        ) : m === 'error' ? (
                          <div className="warn-text">Could not load this game.</div>
                        ) : (
                          <MatchDetailView match={m} focusPuuid={profile.puuid} champions={s.champions} items={s.items} version={s.ddragonVersion} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          </div>
        </>
      )}

      {!profile && !busy && (
        <div className="empty" style={{ height: 300 }}>
          <div>Type a Riot ID like <span className="mono">Faker#KR1</span> and press Enter.</div>
        </div>
      )}
    </div>
  )
}
