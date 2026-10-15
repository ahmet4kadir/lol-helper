import { EventEmitter } from 'events'
import { createRequire } from 'module'

/**
 * Global, read-only keyboard listener. Two jobs:
 *  - notice when the scoreboard key (Tab) is held, for the gold widget;
 *  - while a game is running, read the line typed into the in-game chat
 *    (between Enter and Enter/Escape) so "mid flash" can start a timer.
 * Nothing is blocked or injected, nothing is stored, and the chat buffer is
 * only active in game. The native module is optional: without it the app
 * runs with both features off.
 */
export class KeyHook extends EventEmitter {
  available = false
  error = ''
  inGame = false
  private tabDown = false
  private chatOpen = false
  private buffer = ''
  private shift = false
  private keys: Record<string, number> | null = null
  private letters = new Map<number, string>()

  start(): void {
    try {
      const req = createRequire(__filename)
      const { uIOhook, UiohookKey } = req('uiohook-napi') as typeof import('uiohook-napi')
      this.keys = UiohookKey as unknown as Record<string, number>
      for (const ch of 'abcdefghijklmnopqrstuvwxyz') this.letters.set(this.keys[ch.toUpperCase()], ch)
      for (const d of '0123456789') this.letters.set(this.keys[d], d)

      uIOhook.on('keydown', (e) => {
        if (e.keycode === UiohookKey.Tab && !this.tabDown) {
          this.tabDown = true
          this.emit('tab', true)
        }
        if (e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) this.shift = true
        this.chatKey(e.keycode)
      })
      uIOhook.on('keyup', (e) => {
        if (e.keycode === UiohookKey.Tab && this.tabDown) {
          this.tabDown = false
          this.emit('tab', false)
        }
        if (e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) this.shift = false
      })
      // Left clicks while Tab is held: the scoreboard. The overlay maps the
      // position onto the enemy spell column the user calibrated.
      uIOhook.on('mousedown', (e) => {
        if (this.tabDown && this.inGame && e.button === 1) this.emit('tabclick', { x: e.x, y: e.y })
      })
      uIOhook.start()
      this.available = true
    } catch (e) {
      this.error = (e as Error).message
      console.warn('uiohook-napi unavailable:', this.error)
    }
  }

  private chatKey(code: number): void {
    const k = this.keys
    if (!k || !this.inGame) {
      this.chatOpen = false
      this.buffer = ''
      return
    }
    if (code === k.Enter) {
      if (this.chatOpen) {
        const text = this.buffer.trim()
        this.chatOpen = false
        this.buffer = ''
        if (text) this.emit('chat', text)
      } else {
        this.chatOpen = true
        this.buffer = ''
      }
      return
    }
    if (!this.chatOpen) return
    if (code === k.Escape) {
      this.chatOpen = false
      this.buffer = ''
      return
    }
    if (code === k.Backspace) {
      this.buffer = this.buffer.slice(0, -1)
      return
    }
    if (code === k.Space) {
      this.buffer += ' '
      return
    }
    const ch = this.letters.get(code)
    if (ch) this.buffer += ch
    if (this.buffer.length > 60) this.buffer = this.buffer.slice(-60)
  }

  stop(): void {
    if (!this.available) return
    try {
      const req = createRequire(__filename)
      ;(req('uiohook-napi') as typeof import('uiohook-napi')).uIOhook.stop()
    } catch {
      /* ignore */
    }
  }
}
