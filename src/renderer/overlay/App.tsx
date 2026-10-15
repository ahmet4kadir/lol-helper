import { useEffect, useState } from 'react'
import { useAppState } from '../hooks/useAppState'
import { Widget } from './Widget'
import { useVisibility } from './useVisibility'
import { useReturnTimers } from './useReturnTimers'
import { fmtTime, lanePairs } from './lanes'
import { parseChatCommand } from '@shared/chatCommands'
import { SUMMONER_LABEL } from '@shared/gameConstants'
import { CampTimers } from './widgets/CampTimers'
import { Objectives } from './widgets/Objectives'
import { GoldDiff } from './widgets/GoldDiff'
import { LaneDiff } from './widgets/LaneDiff'
import { SpellTimers, spellCooldown, ultCooldown, type Timer } from './widgets/SpellTimers'
import { BaseTimer, travelTime } from './widgets/BaseTimer'
import { PlayersOverlay } from './widgets/PlayersOverlay'
import { Deaths } from './widgets/Deaths'
import { Minimap } from './widgets/Minimap'
import { Scoreboard } from './widgets/Scoreboard'
import { BuildAdvice } from './widgets/BuildAdvice'

const WIDGETS: { id: string; title: string }[] = [
  { id: 'clock', title: 'Game' },
  { id: 'objectives', title: 'Objectives' },
  { id: 'camps', title: 'Jungle camps' },
  { id: 'spells', title: 'Enemy spells & ults' },
  { id: 'base', title: 'Base → lane' },
  { id: 'deaths', title: 'Deaths (auto)' },
  { id: 'minimap', title: 'Minimap markers' },
  { id: 'scoreboard', title: 'Tab spell clicks (calibrate)' },
  { id: 'build', title: 'Build advice' },
  { id: 'lanes', title: 'Lanes' },
  { id: 'players', title: 'Players' },
  { id: 'gold', title: 'Gold on Tab (calibrate)' }
]

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function saveLS(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function App() {
  const s = useAppState()
  const edit = s.overlayEditMode
  const live = s.live
  const { hidden, toggle } = useVisibility()
  const [goldMode, setGoldMode] = useState<'tab' | 'always'>(() => loadLS('gold:mode', 'tab'))
  const [globalScale, setGlobalScale] = useState<number>(() => loadLS('overlay:scale', 1))
  const [timers, setTimersState] = useState<Record<string, Timer>>({})
  const [toast, setToast] = useState<string | null>(null)
  const setTimers = (f: (cur: Record<string, Timer>) => Record<string, Timer>) => setTimersState(f)
  const ret = useReturnTimers(live, s.champions, s.champDetails, s.items)

  useEffect(() => saveLS('gold:mode', goldMode), [goldMode])
  useEffect(() => saveLS('overlay:scale', globalScale), [globalScale])

  /** Start (or restart) a timer for an enemy's spell slot, with a short on-screen note. */
  const startSpell = (p: import('@shared/types').LivePlayer, slot: '1' | '2' | 'R', lane: string) => {
    if (!live) return
    const t = live.gameTime
    let cd: number
    let label: string
    if (slot === 'R') {
      const c = Object.values(s.champions).find((x) => x.key === p.rawChampionName.replace('game_character_displayname_', ''))
      cd = ultCooldown(p, c ? s.champDetails[c.id] : undefined, s.items)
      label = 'ult'
    } else {
      const key = slot === '1' ? p.spell1Key : p.spell2Key
      cd = spellCooldown(key, p, false)
      label = SUMMONER_LABEL[key] ?? key
    }
    if (cd <= 0) return
    setTimersState((cur) => ({ ...cur, [`${p.riotId}:${slot}`]: { end: t + cd, total: cd } }))
    setToast(`${lane.toLowerCase()} ${label}: ${fmtTime(cd)}`)
    setTimeout(() => setToast(null), 2500)
  }

  // "mid flash" typed in chat -> timer on that enemy's Flash.
  useEffect(() => {
    return window.helper.onChatCommand((text) => {
      const cmd = parseChatCommand(text)
      if (!cmd || !live) return
      const p = lanePairs(live).find((x) => x.lane === cmd.lane)?.enemy
      if (!p) return
      if (cmd.spell === 'RECALL') {
        const c = Object.values(s.champions).find((x) => x.key === p.rawChampionName.replace('game_character_displayname_', ''))
        const { recall, travel } = travelTime(p, cmd.lane, c ? s.champDetails[c.id] : undefined, s.items, ret.shifts[p.team][cmd.lane] ?? 0)
        ret.start(p.riotId, recall + travel)
        setToast(`${cmd.lane.toLowerCase()} back in lane in ${fmtTime(recall + travel)}`)
        setTimeout(() => setToast(null), 2500)
        return
      }
      const slot: '1' | '2' | 'R' | '' = cmd.spell === 'R' ? 'R' : p.spell1Key === cmd.spell ? '1' : p.spell2Key === cmd.spell ? '2' : ''
      if (slot) startSpell(p, slot, cmd.lane)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, s.champions, s.champDetails])

  const on = (id: string) => !hidden.has(id)
  const showGold = on('gold') && (edit || goldMode === 'always' || !s.keyHookAvailable || s.tabHeld)
  const w = (id: string) => ({ id, editMode: edit, globalScale, onClose: () => toggle(id) })
  const none = <div className="muted">-</div>

  return (
    <>
      {edit && <div className="overlay-hint">Overlay edit mode: drag widgets, +/− to resize, × to hide, Ctrl+Shift+L to lock</div>}
      {toast && <div className="overlay-toast">{toast}</div>}

      {edit && (
        <Widget id="dock" title="Widgets" editMode={edit} defaultPos={{ x: 24, y: 40 }} className="dock">
          {WIDGETS.map((x) => (
            <label key={x.id} className="dock-row">
              <input type="checkbox" checked={on(x.id)} onChange={() => toggle(x.id)} /> {x.title}
            </label>
          ))}
          <div className="dock-row" style={{ marginTop: 8 }}>
            <span className="muted">Size</span>
            <input type="range" min={0.6} max={1.4} step={0.05} value={globalScale} onChange={(e) => setGlobalScale(Number(e.target.value))} />
            <span className="mono muted">{Math.round(globalScale * 100)}%</span>
          </div>
          <div className="dock-row muted">
            Gold widget:
            <select value={goldMode} onChange={(e) => setGoldMode(e.target.value as 'tab' | 'always')}>
              <option value="tab">while Tab is held</option>
              <option value="always">always</option>
            </select>
          </div>
          <div className="muted" style={{ fontSize: 11 }}>
            {s.keyHookAvailable ? 'Tab detection and chat commands: on' : `Keyboard hook off${s.keyHookError ? `: ${s.keyHookError}` : ''}`}
          </div>
          <button style={{ marginTop: 8 }} onClick={() => window.helper.openControl()}>
            Open main window
          </button>
          <button onClick={() => window.helper.setOverlayEditMode(false)}>Lock overlay</button>
          <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
            v{s.update.version || 'dev'}
          </div>
        </Widget>
      )}

      {on('clock') && (
        <Widget {...w('clock')} title="Game" defaultPos={{ x: 24, y: 300 }}>
          {live ? (
            <>
              <div className="big mono">{fmtTime(live.gameTime)}</div>
              <div className="muted">{live.gameMode}</div>
            </>
          ) : (
            <div className="muted">{s.lcuConnected ? 'Waiting for a game…' : 'Client not running'}</div>
          )}
        </Widget>
      )}

      {on('objectives') && (
        <Widget {...w('objectives')} title="Objectives" defaultPos={{ x: 24, y: 400 }}>
          {live ? <Objectives gameTime={live.gameTime} events={live.events} /> : none}
        </Widget>
      )}

      {on('camps') && (
        <Widget {...w('camps')} title="Jungle camps" defaultPos={{ x: 24, y: 560 }} interactive>
          <CampTimers gameTime={live?.gameTime ?? 0} />
        </Widget>
      )}

      {on('spells') && (
        <Widget {...w('spells')} title="Enemy spells & ults" defaultPos={{ x: 420, y: 300 }} interactive>
          {live ? <SpellTimers live={live} champions={s.champions} champDetails={s.champDetails} items={s.items} version={s.ddragonVersion} timers={timers} setTimers={setTimers} /> : none}
        </Widget>
      )}

      {on('base') && (
        <Widget {...w('base')} title="Base → lane" defaultPos={{ x: 420, y: 560 }} interactive>
          {live ? (
            <BaseTimer live={live} champions={s.champions} champDetails={s.champDetails} items={s.items} info={ret.info} shifts={ret.shifts} start={ret.start} clear={ret.clear} />
          ) : (
            none
          )}
        </Widget>
      )}

      {on('deaths') && (
        <Widget {...w('deaths')} title="Deaths" defaultPos={{ x: 720, y: 300 }}>
          {live ? <Deaths live={live} champions={s.champions} info={ret.info} /> : none}
        </Widget>
      )}

      {on('minimap') && live && (
        <Widget
          {...w('minimap')}
          title="Minimap"
          defaultPos={{ x: Math.max(0, window.innerWidth - 300), y: Math.max(0, window.innerHeight - 300) }}
          defaultSize={{ w: 260, h: 260 }}
          resizable
          className="minimapw"
        >
          <Minimap live={live} champions={s.champions} info={ret.info} timers={timers} editMode={edit} />
        </Widget>
      )}

      {on('scoreboard') && live && (
        <Widget
          {...w('scoreboard')}
          title="Tab spells"
          defaultPos={{ x: Math.max(0, window.innerWidth * 0.62), y: Math.max(0, window.innerHeight * 0.3) }}
          defaultSize={{ w: 56, h: 230 }}
          resizable
          className="scoreboardw"
        >
          <Scoreboard
            live={live}
            editMode={edit}
            onSpellClick={(p, slot) => startSpell(p, slot, lanePairs(live).find((x) => x.enemy?.riotId === p.riotId)?.lane ?? '')}
          />
        </Widget>
      )}

      {on('build') && live && (
        <Widget {...w('build')} title="Build" defaultPos={{ x: 720, y: 560 }} className="buildw">
          <BuildAdvice s={s} />
        </Widget>
      )}

      {on('lanes') && (
        <Widget {...w('lanes')} title="Lanes" defaultPos={{ x: 240, y: 300 }}>
          {live ? <LaneDiff live={live} /> : none}
        </Widget>
      )}

      {on('players') && live && (
        <Widget {...w('players')} title="Players" defaultPos={{ x: Math.max(0, window.innerWidth - 560), y: 300 }} className="playersw">
          <PlayersOverlay s={s} />
        </Widget>
      )}

      {showGold && (
        <Widget
          {...w('gold')}
          title={`Gold${edit && goldMode === 'tab' ? ' · while Tab is held' : ''}`}
          defaultPos={{ x: Math.max(0, window.innerWidth / 2 - 40), y: Math.max(0, window.innerHeight * 0.3) }}
          defaultSize={{ w: 80, h: 230 }}
          resizable
          className="goldw"
        >
          {live ? <GoldDiff live={live} editMode={edit} /> : none}
        </Widget>
      )}
    </>
  )
}
