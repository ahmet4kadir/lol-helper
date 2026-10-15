import { useState } from 'react'
import type { AppState } from '@shared/types'
import { PlayerCard, kda, winRate } from './PlayerCard'
import { champIcon } from '../hooks/useAppState'

const QUEUE: Record<number, string> = { 420: 'Solo', 440: 'Flex', 400: 'Normal', 430: 'Blind', 450: 'ARAM', 490: 'Quick', 1700: 'Arena' }

/** Search any player by Riot ID and see rank, recent games and top champions. */
export function LookupPanel({ s }: { s: AppState }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [puuid, setPuuid] = useState<string | null>(null)
  const profile = puuid ? s.profiles[puuid] : undefined

  const go = async () => {
    if (!q.trim()) return
    setBusy(true)
    setErr(null)
    const r = await window.helper.lookupPlayer(q.trim())
    setBusy(false)
    if (r.ok && r.puuid) setPuuid(r.puuid)
    else setErr(r.error ?? 'Lookup failed')
  }

  return (
    <div>
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
        <div className="lookup-grid">
          <div>
            <PlayerCard profile={profile} champions={s.champions} />
            <section className="team" style={{ marginTop: 12 }}>
              <h2>Champions (last {profile.recent.length})</h2>
              {profile.champions.slice(0, 10).map((c) => {
                const ci = s.champions[c.championId]
                if (!ci) return null
                return (
                  <div key={c.championId} className="player">
                    <img src={champIcon(ci.key)} alt="" />
                    <div>
                      <div className="name">{ci.name}</div>
                      <div className="pos">
                        {c.games ? `${c.wins}W ${c.games - c.wins}L · ${kda(c.kills, c.deaths, c.assists)} KDA` : 'no recent games'}
                        {c.masteryPoints ? ` · M${c.masteryLevel} ${Math.round(c.masteryPoints / 1000)}k` : ''}
                      </div>
                    </div>
                    {c.games > 0 && <span className="mono">{winRate(c.wins, c.games - c.wins)}%</span>}
                  </div>
                )
              })}
            </section>
          </div>
          <section className="team">
            <h2>Recent games</h2>
            {profile.recent.map((g) => {
              const ci = s.champions[g.championId]
              return (
                <div key={g.gameId} className={`game ${g.win ? 'win' : 'loss'}`}>
                  {ci ? <img src={champIcon(ci.key)} alt="" /> : <span className="noimg" />}
                  <div>
                    <div className="name">
                      {ci?.name ?? g.championId} <span className="muted">· {QUEUE[g.queueId] ?? g.queueId}</span>
                    </div>
                    <div className="pos">
                      {g.kills}/{g.deaths}/{g.assists} · {g.cs} cs · {Math.round(g.durationSec / 60)} min
                    </div>
                  </div>
                  <span className="mono">{g.win ? 'W' : 'L'}</span>
                </div>
              )
            })}
          </section>
        </div>
      )}
    </div>
  )
}
