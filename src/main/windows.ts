import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

const isDev = !!process.env.ELECTRON_RENDERER_URL

function load(win: BrowserWindow, page: 'control' | 'overlay'): void {
  if (isDev) void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}.html`)
  else void win.loadFile(join(__dirname, `../renderer/${page}.html`))
}

export function createControlWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: 'LoL Helper',
    backgroundColor: '#0b0e14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })
  load(win, 'control')
  return win
}

/**
 * Transparent, frameless, always-on-top window that sits over the game.
 * Requires the game to run in Borderless or Windowed mode (not exclusive
 * fullscreen). Nothing is injected into the game process.
 */
export function createOverlayWindow(): BrowserWindow {
  // Full display bounds, not the work area: a borderless game covers the
  // taskbar too, and the minimap sits in that bottom strip.
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds
  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Keep covering the whole display if resolution or display layout changes.
  const fit = () => {
    if (win.isDestroyed()) return
    const b = screen.getPrimaryDisplay().bounds
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height })
  }
  screen.on('display-metrics-changed', fit)
  screen.on('display-added', fit)
  screen.on('display-removed', fit)
  load(win, 'overlay')
  return win
}

/**
 * The overlay always starts click-through. In edit mode the renderer asks to
 * capture the mouse while the cursor is over a widget (see useClickThrough),
 * so empty space never blocks the game. Locked mode ignores those requests.
 */
export function setOverlayEditMode(win: BrowserWindow, _edit: boolean): void {
  win.setIgnoreMouseEvents(true, { forward: true })
}

export function setOverlayIgnoreMouse(win: BrowserWindow, ignore: boolean): void {
  win.setIgnoreMouseEvents(ignore, { forward: true })
}
