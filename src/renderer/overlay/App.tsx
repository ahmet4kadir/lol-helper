import { useState } from 'react'
import { useAppState } from '../hooks/useAppState'
import { Widget } from './Widget'
import { useVisibility } from './useVisibility'
import { fmtTime } from './lanes'
import { CampTimers } from './widgets/CampTimers'
import { Objectives } from './widgets/Objectives'
import { GoldDiff } from './widgets/GoldDiff'
import { LaneDiff } from './widgets/LaneDiff'
import { SpellTimers } from './widgets/SpellTimers'
import { BaseTimer } from './widgets/BaseTimer'
import { PlayersOverlay } from './widgets/PlayersOverlay'
import { Deaths } from './widgets/Deaths'

const WIDGETS: { id: string; title: string }[] = [
  { id: 'clock', title: 'Game' },
  { id: 'objectives', title: 'Objectives' },
  { id: 'camps', title: 'Jungle camps' },
  { id: 'spells', title: 'Enemy spells & ults' },
  { id: 'base', title: 'Base → lane' },
  { id: 'deaths', title: 'Deaths (auto)' },
  { id: 'lanes', title: 'Lanes' },
  { id: 'players', title: 'Players' },
  { id: 'gold', title: 'Gold (Tab)' }
]

function loadGoldMode(): 'tab' | 'always' {
  try {
    return localStorage.getItem('gold:mode') === 'always' ? 'always' : 'tab'
  } catch {
    return 'tab'
  }
}

export function App() {
  const s = useAppState()
  const edit = s.overlayEditMode
  const live = s.live
  const { hidden, toggle } = useVisibility()
  const [goldMode, setGoldMode] = useState<'tab' | 'always'>(loadGoldMode)
  const setGold = (m: 'tab' | 'always') => {
    setGoldMode(m)
    try {
      localStorage.setItem('gold:mode', m)
    } catch {
      /* ignore */
    }
  }

  const on = (id: string) => !hidden.has(id)
  const showGold = on('gold') && (edit || goldMode === 'always' || !s.keyHookAvailable || s.tabHeld)
  const w = (id: string) => ({ id, editMode: edit, onClose: () => toggle(id) })
  const none = <div className="muted">-</div>

  return (
    <>
      {edit && <div className="overlay-hint">Overlay edit mode: drag widgets, × to hide, Ctrl+Shift+L to lock</div>}

      {edit && (
        <Widget id="dock" title="Widgets" editMode={edit} defaultPos={{ x: 24, y: 40 }} className="dock">
          {WIDGETS.map((x) => (
            <label key={x.id} className="dock-row">
              <input type="checkbox" checked={on(x.id)} onChange={() => toggle(x.id)} /> {x.title}
            </label>
          ))}
          <div className="dock-row muted" style={{ marginTop: 6 }}>
            Gold widget:
            <select value={goldMode} onChange={(e) => setGold(e.target.value as 'tab' | 'always')}>
              <option value="tab">while Tab is held</option>
              <option value="always">always</option>
            </select>
          </div>
          {!s.keyHookAvailable && <div className="muted" style={{ fontSize: 11 }}>Tab detection unavailable, gold stays visible.</div>}
          <button style={{ marginTop: 8 }} onClick={() => window.helper.openControl()}>
            Open main window
          </button>
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
          {live ? <SpellTimers live={live} champions={s.champions} champDetails={s.champDetails} version={s.ddragonVersion} /> : none}
        </Widget>
      )}

      {on('base') && (
        <Widget {...w('base')} title="Base → lane" defaultPos={{ x: 420, y: 560 }} interactive>
          {live ? <BaseTimer live={live} champions={s.champions} champDetails={s.champDetails} items={s.items} /> : none}
        </Widget>
      )}

      {on('deaths') && (
        <Widget {...w('deaths')} title="Deaths" defaultPos={{ x: 720, y: 300 }}>
          {live ? <Deaths live={live} champions={s.champions} champDetails={s.champDetails} items={s.items} /> : none}
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
        <Widget {...w('gold')} title="Gold difference (items)" defaultPos={{ x: Math.max(0, window.innerWidth / 2 - 180), y: 60 }} className="goldw">
          {live ? <GoldDiff live={live} /> : none}
        </Widget>
      )}
    </>
  )
}
