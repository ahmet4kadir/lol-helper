import { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray } from 'electron'
import { LcuConnector } from './lcu/connector'
import { parseChampSelect, type RawChampSelectSession } from './lcu/champSelect'
import { sendChampSelectMessage } from './lcu/chat'
import { LiveClient } from './live/liveClient'
import { loadStaticData } from './data/ddragon'
import { loadMeta } from './stats/provider'
import { fetchBuild } from './stats/lolalyticsBuild'
import { champSelectAction } from './lcu/champSelectActions'
import { getProfile, resolvePuuid } from './lcu/players'
import { loadChampionDetail } from './data/ddragon'
import type { LiveSnapshot, PlayerProfile } from '@shared/types'
import { KeyHook } from './input/keyHook'
import { createControlWindow, createOverlayWindow, setOverlayEditMode, setOverlayIgnoreMouse } from './windows'
import { trayIcon } from './trayIcon'
import { setCacheDir } from './cacheDir'
import { startUpdater } from './updater'
import { mockChampSelect, mockLive, mockProfile } from './mock'
import { IPC, initialAppState, type AppState } from '@shared/types'

const MOCK = process.env.LOLHELPER_MOCK === '1'

let state: AppState = { ...initialAppState, mock: MOCK }
let controlWin: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let updater: ReturnType<typeof startUpdater> | null = null

function broadcast(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(IPC.state, state)
  }
}

function patch(p: Partial<AppState>): void {
  const prevPhase = state.phase
  const prevCs = state.champSelect
  state = { ...state, ...p }
  broadcast()
  if (p.phase && p.phase !== prevPhase) onPhaseChange(p.phase)
  if ('champSelect' in p && p.champSelect !== prevCs) onChampSelectChange()
}

const IN_GAME = new Set(['GameStart', 'InProgress', 'Reconnect'])

/**
 * Control window: shown for champ select, hidden once the game starts.
 * Overlay: only exists on screen while a game is running.
 */
function onPhaseChange(phase: string): void {
  if (controlWin && !controlWin.isDestroyed()) {
    if (phase === 'ChampSelect') {
      controlWin.show()
      controlWin.focus()
    } else if (IN_GAME.has(phase)) {
      controlWin.hide()
    }
  }
  updateOverlayVisibility()
}

function updateOverlayVisibility(): void {
  if (!overlayWin || overlayWin.isDestroyed()) return
  const show = MOCK || IN_GAME.has(state.phase) || state.liveConnected
  if (show && !overlayWin.isVisible()) overlayWin.showInactive()
  else if (!show && overlayWin.isVisible()) overlayWin.hide()
}

// ---------- Build lookup for the local player's champion ----------
const buildCache = new Map<string, import('@shared/types').ChampBuild>()
let buildInflight = ''

function onChampSelectChange(): void {
  const cs = state.champSelect
  if (!cs) {
    if (state.build) patch({ build: null, buildError: null })
    return
  }
  loadChampSelectProfiles()
  const me = cs.myTeam.find((p) => p.isSelf)
  const championId = me?.championId || me?.pickIntentId || 0
  const champ = state.champions[championId]
  if (!champ) return
  // Lane: assigned position, else the champion's most played lane from meta, else curated.
  const lane = me?.assignedPosition || metaDefaultLane(championId) || champ.roles[0] || 'middle'
  const key = `${championId}:${lane}`
  if (state.build && state.build.championId === championId && state.build.lane === lane) return
  const cached = buildCache.get(key)
  if (cached) {
    patch({ build: cached, buildError: null })
    return
  }
  if (buildInflight === key) return
  buildInflight = key
  fetchBuild(champ, lane)
    .then((b) => {
      buildCache.set(key, b)
      if (buildInflight === key) patch({ build: b, buildError: null })
    })
    .catch((e) => {
      if (buildInflight === key) patch({ build: null, buildError: (e as Error).message })
    })
    .finally(() => {
      if (buildInflight === key) buildInflight = ''
    })
}

// ---------- Player profiles ----------
function storeProfile(p: PlayerProfile): void {
  patch({ profiles: { ...state.profiles, [p.puuid]: p } })
}

function loadProfile(puuid: string): void {
  if (!puuid || MOCK) return
  const have = state.profiles[puuid]
  if (have && Date.now() - have.fetchedAt < 10 * 60 * 1000) return
  getProfile(lcu, puuid)
    .then(storeProfile)
    .catch((e) => console.warn('profile failed', puuid, (e as Error).message))
}

/** Allies' puuids are in the champ select session even when names are hidden. */
function loadChampSelectProfiles(): void {
  for (const p of state.champSelect?.myTeam ?? []) loadProfile(p.puuid)
}

const liveLookups = new Set<string>()
let liveGameKey = ''

/** Once a game is visible, resolve every Riot ID to a puuid and load profiles + champion details. */
function onLiveSnapshot(snap: LiveSnapshot): void {
  const key = snap.players.map((p) => p.riotId).join('|')
  if (key !== liveGameKey) {
    liveGameKey = key
    liveLookups.clear()
    patch({ livePuuids: {} })
  }
  for (const p of snap.players) {
    const champ = Object.values(state.champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
    if (champ && !state.champDetails[champ.id] && state.ddragonVersion) {
      loadChampionDetail(state.ddragonVersion, champ)
        .then((d) => patch({ champDetails: { ...state.champDetails, [d.id]: d } }))
        .catch(() => {})
    }
    if (!p.riotId || liveLookups.has(p.riotId) || MOCK || !lcu.connected) continue
    liveLookups.add(p.riotId)
    resolvePuuid(lcu, p.riotId)
      .then((puuid) => {
        patch({ livePuuids: { ...state.livePuuids, [p.riotId]: puuid } })
        loadProfile(puuid)
      })
      .catch((e) => console.warn('puuid lookup failed', p.riotId, (e as Error).message))
  }
}

function metaDefaultLane(championId: number): string {
  if (!state.meta) return ''
  let best = { lane: '', pct: 0 }
  for (const [lane, rows] of Object.entries(state.meta.byLane)) {
    const r = rows.find((x) => x.championId === championId)
    if (r && (r.lanePct ?? 0) > best.pct) best = { lane, pct: r.lanePct ?? 0 }
  }
  return best.lane
}

// ---------- LCU (client) ----------
const lcu = new LcuConnector()

async function refreshFromLcu(): Promise<void> {
  try {
    const phase = await lcu.request<string>('GET', '/lol-gameflow/v1/gameflow-phase')
    patch({ phase })
    if (phase === 'ChampSelect') {
      const raw = await lcu.request<RawChampSelectSession>('GET', '/lol-champ-select/v1/session')
      patch({ champSelect: parseChampSelect(raw) })
    } else {
      patch({ champSelect: null })
    }
  } catch {
    /* endpoint may 404 outside of champ select */
  }
}

lcu.subscribe('/lol-gameflow/v1/gameflow-phase')
lcu.subscribe('/lol-champ-select/v1/session')

lcu.on('connected', () => {
  patch({ lcuConnected: true })
  void refreshFromLcu()
})
lcu.on('disconnected', () => patch({ lcuConnected: false, phase: 'None', champSelect: null }))
lcu.on('event', (ev: { uri: string; eventType: string; data: unknown }) => {
  if (ev.uri === '/lol-gameflow/v1/gameflow-phase') {
    patch({ phase: String(ev.data) })
    if (ev.data !== 'ChampSelect') patch({ champSelect: null })
  } else if (ev.uri === '/lol-champ-select/v1/session') {
    if (ev.eventType === 'Delete') patch({ champSelect: null })
    else patch({ champSelect: parseChampSelect(ev.data as RawChampSelectSession) })
  }
})

// ---------- Live Client (in-game) ----------
const live = new LiveClient()
live.on('connected', () => {
  patch({ liveConnected: true })
  updateOverlayVisibility()
})
live.on('disconnected', () => {
  patch({ liveConnected: false, live: null })
  updateOverlayVisibility()
})
live.on('snapshot', (snap: LiveSnapshot) => {
  patch({ live: snap })
  onLiveSnapshot(snap)
})

// ---------- Keyboard (Tab held) ----------
const keys = new KeyHook()
keys.on('tab', (held: boolean) => patch({ tabHeld: held }))

// ---------- Meta stats ----------
async function refreshMeta(force = false): Promise<void> {
  try {
    const meta = await loadMeta(force)
    patch({ meta, metaError: null })
  } catch (e) {
    patch({ metaError: (e as Error).message })
  }
}

// ---------- Mock ----------
function startMock(): void {
  const t0 = Date.now()
  patch({ lcuConnected: true, phase: 'ChampSelect', champSelect: mockChampSelect })
  for (const p of mockChampSelect.myTeam) storeProfile(mockProfile(`Ally${p.cellId}#TR1`, p.puuid))
  setInterval(() => {
    const t = Math.floor((Date.now() - t0) / 1000)
    const snap = mockLive(t)
    patch({ liveConnected: true, live: snap })
    onLiveSnapshot(snap)
    if (Object.keys(state.livePuuids).length === 0) {
      const livePuuids: Record<string, string> = {}
      for (const p of snap.players) {
        const prof = mockProfile(p.riotId)
        livePuuids[p.riotId] = prof.puuid
        storeProfile(prof)
      }
      patch({ livePuuids })
    }
  }, 1000)
}

// ---------- IPC ----------
ipcMain.handle(IPC.getState, () => state)
ipcMain.on(IPC.setOverlayEditMode, (_e, edit: boolean) => applyEditMode(edit))
// The renderer asks to capture the mouse only while the cursor is over a widget
// (any widget in edit mode, interactive ones such as timers in locked mode).
ipcMain.on(IPC.setOverlayIgnoreMouse, (_e, ignore: boolean) => {
  if (overlayWin && !overlayWin.isDestroyed()) setOverlayIgnoreMouse(overlayWin, ignore)
})
ipcMain.on(IPC.openControl, () => showControl())
ipcMain.handle(IPC.sendChampSelectChat, async (_e, body: string) => {
  if (MOCK) return { ok: true }
  try {
    await sendChampSelectMessage(lcu, body)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})
ipcMain.on(IPC.refreshMeta, () => void refreshMeta(true))
ipcMain.on(IPC.installUpdate, () => void installUpdate())

/**
 * Tear down everything that touches the system before the installer takes
 * over: the global keyboard hook (a dying process holding a low-level hook
 * stalls Windows input), global shortcuts and the always-on-top overlay.
 */
async function installUpdate(): Promise<void> {
  quitting = true
  try {
    keys.stop()
    globalShortcut.unregisterAll()
    lcu.stop()
    live.stop()
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy()
    tray?.destroy()
  } catch {
    /* best effort */
  }
  // Give the hook thread a moment to unwind before the process is replaced.
  await new Promise((r) => setTimeout(r, 300))
  updater?.installNow()
}
ipcMain.on(IPC.checkUpdate, () => updater?.check())
ipcMain.handle(IPC.lookupPlayer, async (_e, riotId: string) => {
  if (MOCK) {
    const p = mockProfile(riotId)
    storeProfile(p)
    return { ok: true, puuid: p.puuid }
  }
  try {
    const puuid = await resolvePuuid(lcu, riotId)
    const p = await getProfile(lcu, puuid, true)
    storeProfile(p)
    return { ok: true, puuid }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})
ipcMain.handle(IPC.champSelectAction, async (_e, championId: number, lock: boolean) => {
  if (MOCK) return { ok: true, type: 'pick' }
  try {
    const r = await champSelectAction(lcu, championId, lock)
    return { ok: true, type: r.type }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

function applyEditMode(edit: boolean): void {
  if (overlayWin && !overlayWin.isDestroyed()) setOverlayEditMode(overlayWin, edit)
  patch({ overlayEditMode: edit })
}

function showControl(): void {
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.show()
    controlWin.focus()
  } else {
    controlWin = createControlWindow()
    wireControl(controlWin)
  }
}

/** Closing the control window hides it; the app keeps running in the tray. */
function wireControl(win: BrowserWindow): void {
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
  })
}

function createTray(): void {
  tray = new Tray(trayIcon())
  tray.setToolTip('LoL Helper')
  const menu = Menu.buildFromTemplate([
    { label: 'Open', click: showControl },
    { label: 'Toggle overlay edit mode', click: () => applyEditMode(!state.overlayEditMode) },
    { label: 'Refresh meta stats', click: () => void refreshMeta(true) },
    { label: 'Check for updates', click: () => updater?.check() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.on('click', showControl)
}

// ---------- App ----------
app.whenReady().then(async () => {
  setCacheDir(app.getPath('userData'))
  controlWin = createControlWindow()
  wireControl(controlWin)
  overlayWin = createOverlayWindow()
  overlayWin.hide() // shown by updateOverlayVisibility() once a game is running
  applyEditMode(true)
  createTray()

  // Ctrl+Shift+L toggles overlay edit/locked mode from inside the game.
  globalShortcut.register('CommandOrControl+Shift+L', () => applyEditMode(!state.overlayEditMode))

  keys.start()
  patch({ keyHookAvailable: keys.available })
  updater = startUpdater((update) => patch({ update }))

  try {
    const { champions, items, runes, version } = await loadStaticData()
    patch({ champions, items, runes, ddragonVersion: version })
  } catch (e) {
    console.error('Data Dragon load failed', e)
  }
  await refreshMeta()
  onChampSelectChange()
  updateOverlayVisibility()

  if (MOCK) startMock()
  else {
    lcu.start()
    live.start()
  }
})

app.on('before-quit', () => {
  quitting = true
  keys.stop()
  globalShortcut.unregisterAll()
  lcu.stop()
  live.stop()
})

// Keep running in the tray even when every window is hidden/closed.
app.on('window-all-closed', () => {
  /* no-op */
})
