import { useMemo, useState } from 'react'
import type { AppState, ChampLaneStats, ChampSelectPlayer, ChampSelectState, ChampionInfo, MetaStats } from '@shared/types'
import { analyzeTeam, buildAdvice, compositionChatLine, inferLanes, pickAdvice, LANE_LABEL, LANES } from '@shared/analysis'
import { champIcon } from '../hooks/useAppState'
import { BuildPanel } from './BuildPanel'
import { PlayerCard } from './PlayerCard'

type Champs = Record<number, ChampionInfo>

function PlayerRow({
  p,
  champ,
  intent,
  lane,
  laneGuessed
}: {
  p: ChampSelectPlayer
  champ?: ChampionInfo
  intent?: ChampionInfo
  lane: string
  laneGuessed: boolean
}) {
  const shown = champ ?? intent
  return (
    <div className={`player ${p.isSelf ? 'self' : ''}`}>
      {shown ? <img src={champIcon(shown.key)} alt="" /> : <div className="noimg" />}
      <div>
        <div className="name">
          {shown ? shown.name : 'Picking…'}
          {!champ && intent && <span className="muted"> (intent)</span>}
          {p.isSelf && <span className="muted"> · you</span>}
        </div>
        <div className="pos">
          {LANE_LABEL[lane] ?? lane}
          {laneGuessed && lane && <span className="muted"> (guess)</span>}
          {shown && shown.compTags.length > 0 && <span className="muted"> · {shown.compTags.slice(0, 3).join(', ')}</span>}
        </div>
      </div>
      {shown && <span className={`badge ${shown.damageType}`}>{shown.damageType}</span>}
    </div>
  )
}

function Team({
  title,
  side,
  players,
  champions,
  lanes,
  laneGuessed
}: {
  title: string
  side: 'ally' | 'enemy'
  players: ChampSelectPlayer[]
  champions: Champs
  lanes: string[]
  laneGuessed: boolean
}) {
  const a = analyzeTeam(players.map((p) => champions[p.championId]))
  return (
    <section className={`team ${side}`}>
      <h2>{title}</h2>
      {players.map((p, i) => (
        <PlayerRow
          key={p.cellId}
          p={p}
          champ={champions[p.championId]}
          intent={champions[p.pickIntentId]}
          lane={lanes[i]}
          laneGuessed={laneGuessed}
        />
      ))}
      <div className="dmgbar">
        <div style={{ width: `${a.adPct}%` }} />
      </div>
      <div className="dmglabel">
        <span>
          <b style={{ color: 'var(--ad)' }}>{a.ad} AD</b> · {a.mixed} mixed · <b style={{ color: 'var(--ap)' }}>{a.ap} AP</b>
        </span>
        <span>{a.adPct}% physical</span>
      </div>
      <div className="verdict">{a.damageVerdict}</div>
      {a.missing.length > 0 && (
        <div className="missing">
          {a.missing.map((m) => (
            <span key={m} className="chip warn">
              {m}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

/** A clickable suggestion list: click = hover in client, "Lock" = lock in. */
function Suggestions({
  title,
  rows,
  champions,
  note,
  actionType,
  onAct
}: {
  title: string
  rows: ChampLaneStats[]
  champions: Champs
  note?: string
  actionType: string | null
  onAct: (championId: number, lock: boolean) => void
}) {
  const verb = actionType === 'ban' ? 'Ban' : actionType === 'pick' ? 'Pick' : null
  return (
    <section className="team">
      <h2>{title}</h2>
      {note && (
        <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
          {note}
        </div>
      )}
      {rows.length === 0 && <div className="muted">-</div>}
      {rows.map((r) => {
        const c = champions[r.championId]
        if (!c) return null
        return (
          <div
            key={r.championId + r.lane}
            className={`suggest ${verb ? 'clickable' : ''}`}
            onClick={() => verb && onAct(r.championId, false)}
            title={verb ? `Click: hover ${c.name} in client` : 'No ban/pick action in progress'}
          >
            <img src={champIcon(c.key)} alt="" />
            <div>
              <div className="name">
                {c.name} <span className={`badge ${c.damageType}`}>{c.damageType}</span>
              </div>
              <div className="pos">
                <b style={{ color: r.winRate >= 52 ? 'var(--ok)' : 'inherit' }}>{r.winRate.toFixed(1)}%</b> · {r.pickRate.toFixed(1)}% pick
                {r.banRate > 0 && <> · {r.banRate.toFixed(1)}% ban</>}
              </div>
            </div>
            {verb && (
              <button
                className="lock"
                onClick={(e) => {
                  e.stopPropagation()
                  onAct(r.championId, true)
                }}
              >
                {verb}
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}

export function ChampSelectPanel({ cs, s }: { cs: ChampSelectState; s: AppState }) {
  const { champions, meta, metaError } = s
  const [sent, setSent] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // When meta stats are loaded, lane priorities come from real lane-share data
  // instead of the curated table.
  const withMetaRoles = (c?: ChampionInfo): ChampionInfo | undefined => {
    if (!c || !meta) return c
    const shares = LANES.map((lane) => ({
      lane,
      pct: meta.byLane[lane]?.find((r) => r.championId === c.id)?.lanePct ?? 0
    }))
      .filter((x) => x.pct >= 5)
      .sort((a, b) => b.pct - a.pct)
    return shares.length ? { ...c, roles: shares.map((x) => x.lane) } : c
  }
  const myChamps = cs.myTeam.map((p) => withMetaRoles(champions[p.championId]))
  const theirChamps = cs.theirTeam.map((p) => withMetaRoles(champions[p.championId]))
  const me = cs.myTeam.find((p) => p.isSelf)
  const myLane = me?.assignedPosition ?? ''
  const myChamp = champions[me?.championId || me?.pickIntentId || 0]

  const myLanes = cs.myTeam.map((p) => p.assignedPosition)
  const allyLanesKnown = myLanes.some(Boolean)
  const allyLanes = allyLanesKnown ? myLanes : inferLanes(myChamps)
  const enemyLanes = inferLanes(theirChamps)

  const line = compositionChatLine(myChamps, theirChamps)
  const build = buildAdvice(theirChamps)
  const picks = pickAdvice(myChamps, theirChamps, myLane)
  const actionType = cs.myAction?.type ?? null

  const taken = new Set<number>([
    ...cs.myTeam.map((p) => p.championId),
    ...cs.theirTeam.map((p) => p.championId),
    ...cs.myBans,
    ...cs.theirBans
  ])

  const { pickRows, laneBanRows, banRows } = useMemo(() => {
    if (!meta) return { pickRows: [], laneBanRows: [], banRows: [] }
    const lane = myLane || 'middle'
    const laneRows = (meta.byLane[lane] ?? []).filter((r) => !taken.has(r.championId) && r.pickRate >= 1)
    const a = analyzeTeam(myChamps)
    const wantAP = a.ap === 0 && a.ad >= 2
    const wantAD = a.ad === 0 && a.ap >= 2
    const pickRows = laneRows
      .filter((r) => {
        const c = champions[r.championId]
        if (!c) return false
        if (wantAP && c.damageType === 'AD') return false
        if (wantAD && c.damageType === 'AP') return false
        return true
      })
      .slice(0, 8)
    const strength = (r: ChampLaneStats) => (r.winRate - 50) * r.pickRate
    // Bans in your own lane: what you least want to face.
    const laneBanRows = [...laneRows].sort((x, y) => strength(y) - strength(x)).slice(0, 6)
    // Bans overall.
    const all: ChampLaneStats[] = []
    for (const l of LANES) for (const r of meta.byLane[l] ?? []) all.push(r)
    const seen = new Set<number>()
    const banRows = all
      .filter((r) => !taken.has(r.championId) && r.pickRate >= 2)
      .sort((x, y) => strength(y) - strength(x))
      .filter((r) => (seen.has(r.championId) ? false : (seen.add(r.championId), true)))
      .slice(0, 6)
    return { pickRows, laneBanRows, banRows }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, myLane, cs, champions])

  const act = async (championId: number, lock: boolean) => {
    const r = await window.helper.champSelectAction(championId, lock)
    const name = champions[championId]?.name ?? championId
    setToast(r.ok ? `${lock ? 'Locked' : 'Hovered'} ${name} (${r.type})` : `Failed: ${r.error}`)
    setTimeout(() => setToast(null), 2500)
  }

  const send = async () => {
    const r = await window.helper.sendChampSelectChat(line)
    setSent(r.ok ? 'Sent' : `Failed: ${r.error}`)
    setTimeout(() => setSent(null), 2500)
  }

  return (
    <div className="cs">
      <div className="cs-head">
        <h2>
          Champ Select {myLane && <span className="muted">· you are {LANE_LABEL[myLane]}</span>}
          {actionType && <span className="chip act">{actionType === 'ban' ? 'Your ban' : 'Your pick'} now</span>}
        </h2>
        <span className="muted mono">
          {cs.timerPhase} · {Math.max(0, Math.round(cs.timeLeftMs / 1000))}s
        </span>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div className="cs-grid">
        <Team title="Your team" side="ally" players={cs.myTeam} champions={champions} lanes={allyLanes} laneGuessed={!allyLanesKnown} />
        <Team title="Enemy team" side="enemy" players={cs.theirTeam} champions={champions} lanes={enemyLanes} laneGuessed />
        <section className="team">
          <h2>Advice</h2>
          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
            PICK
          </div>
          {picks.length ? picks.map((t) => <div key={t} className="advice">{t}</div>) : <div className="muted advice">Nothing specific yet.</div>}
          <div className="muted" style={{ fontSize: 11, margin: '10px 0 4px' }}>
            BUILD VS THEM
          </div>
          {build.length ? build.map((t) => <div key={t} className="advice">{t}</div>) : <div className="muted advice">Waiting for enemy picks.</div>}
          <div className="chatline compact">
            <span className="mono">{line || '-'}</span>
            <button className="primary" onClick={send} disabled={!line}>
              {sent ?? 'Send to chat'}
            </button>
          </div>
        </section>
      </div>

      <section className="team" style={{ marginBottom: 12 }}>
        <h2>Teammates</h2>
        <div className="mates">
          {cs.myTeam.map((p, i) => (
            <PlayerCard
              key={p.cellId}
              profile={s.profiles[p.puuid]}
              champion={champions[p.championId] ?? champions[p.pickIntentId]}
              champions={champions}
              label={p.isSelf ? 'You' : `${LANE_LABEL[allyLanes[i]] ?? 'Player'}`}
              position={allyLanes[i]}
              compact
            />
          ))}
        </div>
      </section>

      <div className="cs-grid">
        {meta ? (
          <>
            <Suggestions
              title={`Top picks: ${LANE_LABEL[myLane || 'middle']}`}
              rows={pickRows}
              champions={champions}
              note={`${meta.source} · patch ${meta.patch} · Emerald+ · filtered to what your team needs`}
              actionType={actionType}
              onAct={act}
            />
            <Suggestions
              title={`Bans: ${LANE_LABEL[myLane || 'middle']}`}
              rows={laneBanRows}
              champions={champions}
              note="Strongest champions in your own lane"
              actionType={actionType}
              onAct={act}
            />
            <Suggestions title="Bans: overall" rows={banRows} champions={champions} note="Win rate × pick rate, all lanes" actionType={actionType} onAct={act} />
          </>
        ) : (
          <section className="team">
            <h2>Meta picks</h2>
            <div className="muted">
              {metaError ? `Stats unavailable: ${metaError}` : 'Loading meta stats…'}{' '}
              <button onClick={() => window.helper.refreshMeta()}>Retry</button>
            </div>
          </section>
        )}
      </div>

      <BuildPanel build={s.build} error={s.buildError} champ={myChamp} items={s.items} runes={s.runes} version={s.ddragonVersion} />
    </div>
  )
}
