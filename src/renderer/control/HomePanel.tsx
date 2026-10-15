import { useState } from 'react'
import type { AppState, ChampLaneStats, MatchDetail, PlayerProfile, RecentGame } from '@shared/types'
import { averages } from '@shared/playerTraits'
import { LANE_LABEL, LANES } from '@shared/analysis'
import { ProfileHeader, Tile } from './ProfileHeader'
import { PlayerCard, kda, winRate } from './PlayerCard'
import { MatchDetailView, fmtDuration } from './MatchDetailView'
import { champIcon } from '../hooks/useAppState'

const HISTORY_TO_LANE: Record<string, string> = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'middle', BOTTOM: 'bottom', SUPPORT: 'utility' }

function mainLane(p: PlayerProfile): string {
  const a = averages(p.recent)
  const top = a ? Object.entries(a.lanes).sort((x, y) => y[1] - x[1])[0]?.[0] : undefined
  return (top && HISTORY_TO_LANE[top]) || 'middle'
}

/** Meta row for a champion in the lane it is most played, if the provider has it. */
function metaFor(s: AppState, championId: number): ChampLaneStats | undefined {
  if (!s.meta) return undefined
  let best: ChampLaneStats | undefined
  for (const lane of LANES) {
    const r = s.meta.byLane[lane]?.find((x) => x.championId === championId)
    if (r && (!best || (r.lanePct ?? 0) > (best.lanePct ?? 0))) best = r
  }
  return best
}

function delta(cur: number, avg: number, digits = 1, invert = false): { text: string; tone?: 'good' | 'bad' } {
  const d = cur - avg
  if (Math.abs(d) < 1e-9) return { text: 'same as usual' }
  const better = invert ? d < 0 : d > 0
  return { text: `${d > 0 ? '+' : ''}${d.toFixed(digits)} vs your avg`, tone: better ? 'good' : 'bad' }
}

/** Last game, measured against the player's own averages from the games before it. */
function LastGame({ s, p }: { s: AppState; p: PlayerProfile }) {
  const [open, setOpen] = useState(false)
  const [match, setMatch] = useState<MatchDetail | 'loading' | 'error' | null>(null)
  const g: RecentGame | undefined = p.recent[0]
  if (!g) return null
  const base = averages(p.recent.slice(1)) ?? averages(p.recent)
  const c = s.champions[g.championId]
  const min = Math.max(1, g.durationSec / 60)
  const visionPerMin = g.visionScore / min
  const csPerMin = g.cs / min
  const dmgPerMin = g.damageToChamps / min

  const toggle = async () => {
    setOpen(!open)
    if (match || open) return
    setMatch('loading')
    const r = await window.helper.getMatch(g.gameId)
    setMatch(r.ok && r.match ? r.match : 'error')
  }

  return (
    <section className={`team lastgame ${g.win ? 'win' : 'loss'}`}>
      <div className="lastgame-head" onClick={toggle} title="Click for the full scoreboard">
        {c ? <img src={champIcon(c.key)} alt="" /> : <span className="noimg" />}
        <div>
          <h2>
            Last game: <span className={g.win ? 'pos' : 'neg'}>{g.win ? 'Victory' : 'Defeat'}</span> on {c?.name ?? g.championId}
          </h2>
          <div className="muted">
            {g.kills}/{g.deaths}/{g.assists} · {fmtDuration(g.durationSec)} · {open ? 'click to close' : 'click for scoreboard'}
          </div>
        </div>
      </div>
      {base && (
        <div className="tiles five">
          <Tile label="KDA" value={kda(g.kills, g.deaths, g.assists)} {...tileDelta(delta(g.deaths, base.deaths, 1, true), `${g.deaths} deaths`)} />
          <Tile label="CS / min" value={csPerMin.toFixed(1)} {...tileDelta(delta(csPerMin, base.csPerMin))} />
          <Tile label="Vision / min" value={visionPerMin.toFixed(2)} {...tileDelta(delta(visionPerMin, base.visionPerMin, 2))} />
          <Tile label="Damage / min" value={Math.round(dmgPerMin).toLocaleString()} {...tileDelta(delta(dmgPerMin, base.dmgPerMin, 0))} />
          <Tile label="Control wards" value={String(g.controlWards)} {...tileDelta(delta(g.controlWards, base.controlWards))} />
        </div>
      )}
      {open && (
        <div className="game-detail">
          {match === 'loading' || !match ? (
            <div className="muted">Loading scoreboard…</div>
          ) : match === 'error' ? (
            <div className="warn-text">Could not load this game.</div>
          ) : (
            <MatchDetailView match={match} focusPuuid={p.puuid} champions={s.champions} items={s.items} version={s.ddragonVersion} />
          )}
        </div>
      )}
    </section>
  )
}

function tileDelta(d: { text: string; tone?: 'good' | 'bad' }, prefix?: string): { sub: string; tone?: 'good' | 'bad' } {
  return { sub: prefix ? `${prefix} · ${d.text}` : d.text, tone: d.tone }
}

/** Your champions next to how they do in the current patch. */
function Pool({ s, p }: { s: AppState; p: PlayerProfile }) {
  const rows = p.champions.filter((c) => c.games >= 1).slice(0, 10)
  if (rows.length === 0) return null
  return (
    <section className="team">
      <h2>
        Your champions vs the patch <span className="muted">· {s.meta ? `patch ${s.meta.patch}, Emerald+` : 'meta loading'}</span>
      </h2>
      <div className="pool-head muted">
        <span>Champion</span>
        <span>You</span>
        <span>Meta</span>
        <span />
      </div>
      {rows.map((c) => {
        const ci = s.champions[c.championId]
        if (!ci) return null
        const you = winRate(c.wins, c.games - c.wins)
        const m = metaFor(s, c.championId)
        const gap = m ? you - m.winRate : 0
        let note = ''
        if (m && m.winRate < 49) note = 'weak this patch'
        else if (m && m.winRate >= 52 && you >= 55) note = 'strong and you play it well'
        else if (m && gap <= -10 && c.games >= 4) note = 'you underperform on it'
        else if (m && gap >= 10 && c.games >= 4) note = 'your pocket pick'
        return (
          <div key={c.championId} className="pool-head pool-line">
            <span className="pool-name">
              <img src={champIcon(ci.key)} alt="" /> {ci.name} <span className="muted">· {c.games}g</span>
            </span>
            <span className={`mono ${you >= 55 ? 'pos' : you < 45 ? 'neg' : ''}`}>{you}%</span>
            <span className={`mono ${m ? (m.winRate >= 51.5 ? 'pos' : m.winRate < 49 ? 'neg' : '') : 'muted'}`}>{m ? `${m.winRate.toFixed(1)}%` : '-'}</span>
            <span className={`muted ${note.includes('weak') || note.includes('under') ? 'warn-text' : ''}`}>{note}</span>
          </div>
        )
      })}
    </section>
  )
}

/** Top picks and bans for the lane you play most. */
function PatchMeta({ s, lane }: { s: AppState; lane: string }) {
  if (!s.meta) {
    return (
      <section className="team">
        <h2>Patch meta</h2>
        <div className="muted">{s.metaError ? `Stats unavailable: ${s.metaError}` : 'Loading meta stats…'}</div>
      </section>
    )
  }
  const rows = (s.meta.byLane[lane] ?? []).filter((r) => r.pickRate >= 1)
  const picks = [...rows].sort((a, b) => b.winRate - a.winRate).slice(0, 5)
  const bans = [...rows].sort((a, b) => (b.winRate - 50) * b.pickRate - (a.winRate - 50) * a.pickRate).slice(0, 5)
  const List = ({ title, items }: { title: string; items: ChampLaneStats[] }) => (
    <div>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {title}
      </div>
      {items.map((r) => {
        const c = s.champions[r.championId]
        return c ? (
          <div key={r.championId} className="meta-row">
            <img src={champIcon(c.key)} alt="" />
            <span className="name">{c.name}</span>
            <span className="mono">
              <b style={{ color: r.winRate >= 52 ? 'var(--ok)' : 'inherit' }}>{r.winRate.toFixed(1)}%</b> <span className="muted">· {r.pickRate.toFixed(1)}% pick</span>
            </span>
          </div>
        ) : null
      })}
    </div>
  )
  return (
    <section className="team">
      <h2>
        Patch {s.meta.patch} <span className="muted">· {LANE_LABEL[lane]} · Emerald+</span>
      </h2>
      <div className="meta-cols">
        <List title="Strongest picks" items={picks} />
        <List title="Worth banning" items={bans} />
      </div>
    </section>
  )
}

export function HomePanel({ s }: { s: AppState }) {
  const me = s.profiles[s.mePuuid]
  const others = s.lobby.filter((m) => m.puuid !== s.mePuuid)

  if (!s.lcuConnected && !s.mock) {
    return (
      <div className="empty">
        <div>
          Start the League client. <br />
          This app only reads the local client and game APIs; nothing is injected.
        </div>
      </div>
    )
  }
  if (!me) {
    return (
      <div className="empty">
        <div className="muted">Loading your profile…</div>
      </div>
    )
  }
  const lane = mainLane(me)
  return (
    <div className="home">
      <ProfileHeader p={me} s={s} />

      {others.length > 0 && (
        <section className="team" style={{ marginBottom: 12 }}>
          <h2>
            In your lobby <span className="muted">· {others.length + 1} players</span>
          </h2>
          <div className="mates">
            {others.map((m) => (
              <PlayerCard key={m.puuid} profile={s.profiles[m.puuid]} champions={s.champions} label={m.riotId} position={m.pos1} />
            ))}
          </div>
        </section>
      )}

      <LastGame s={s} p={me} />

      <div className="home-grid">
        <Pool s={s} p={me} />
        <PatchMeta s={s} lane={lane} />
      </div>
    </div>
  )
}
