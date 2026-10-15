import { useState } from 'react'
import { useAppState } from '../hooks/useAppState'
import { ChampSelectPanel } from './ChampSelectPanel'
import { LivePanel } from './LivePanel'
import { LookupPanel } from './LookupPanel'
import { HomePanel } from './HomePanel'

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`pill ${on ? 'on' : ''}`}>
      <span className="dot" /> {label}
    </span>
  )
}

type Tab = 'now' | 'lookup'

function UpdatePill({ s }: { s: ReturnType<typeof useAppState> }) {
  const u = s.update
  if (u.state === 'disabled') return u.version ? <span className="pill muted">v{u.version} dev</span> : null
  if (u.state === 'ready')
    return (
      <button className="primary" onClick={() => window.helper.installUpdate()} title={`v${u.next} downloaded`}>
        Restart to update → v{u.next}
      </button>
    )
  if (u.state === 'downloading') return <span className="pill">Downloading v{u.next ?? ''} {u.percent ?? 0}%</span>
  if (u.state === 'error')
    return (
      <span className="pill" title={u.error}>
        v{u.version} · update failed <button onClick={() => window.helper.checkUpdate()}>retry</button>
      </span>
    )
  return <span className="pill">v{u.version}{u.state === 'checking' ? ' · checking…' : ''}</span>
}

export function App() {
  const s = useAppState()
  const [tab, setTab] = useState<Tab>('now')
  return (
    <div className="control-layout">
      <header className="topbar">
        <h1>LoL Helper</h1>
        <nav className="tabs">
          <button className={tab === 'now' ? 'active' : ''} onClick={() => setTab('now')}>
            Now
          </button>
          <button className={tab === 'lookup' ? 'active' : ''} onClick={() => setTab('lookup')}>
            Player lookup
          </button>
        </nav>
        <Pill on={s.lcuConnected} label={s.lcuConnected ? 'Client' : 'No client'} />
        <Pill on={s.liveConnected} label={s.liveConnected ? 'In game' : 'No game'} />
        <span className="pill">{s.phase}</span>
        {s.mock && <span className="pill">MOCK</span>}
        {!s.keyHookAvailable && !s.mock && (
          <span className="pill" title="uiohook-napi failed to load; Tab-held gold widget will stay visible instead">
            Tab detect off
          </span>
        )}
        <span style={{ flex: 1 }} />
        <UpdatePill s={s} />
        <span className="pill">
          Overlay {s.overlayEditMode ? 'edit' : 'locked'} <span className="muted">· Ctrl+Shift+L</span>
        </span>
        <button onClick={() => window.helper.setOverlayEditMode(!s.overlayEditMode)}>{s.overlayEditMode ? 'Lock' : 'Unlock'}</button>
      </header>
      <main className="content">
        {tab === 'lookup' ? (
          <LookupPanel s={s} />
        ) : s.champSelect ? (
          <ChampSelectPanel cs={s.champSelect} s={s} />
        ) : s.live ? (
          <LivePanel s={s} />
        ) : (
          <HomePanel s={s} />
        )}
      </main>
    </div>
  )
}
