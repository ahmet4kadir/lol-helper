import { useState } from 'react'
import type { AppState, MatchDetail } from '@shared/types'
import { kda, winRate } from './PlayerCard'
import { ProfileHeader } from './ProfileHeader'
import { MatchDetailView, fmtDuration } from './MatchDetailView'
import { champIcon } from '../hooks/useAppState'

const QUEUE: Record<number, string> = { 420: 'Ranked Solo', 440: 'Ranked Flex', 400: 'Normal', 430: 'Blind', 450: 'ARAM', 490: 'Quickplay', 1700: 'Arena' }

function ago(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
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
          <ProfileHeader p={profile} s={s} />

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
