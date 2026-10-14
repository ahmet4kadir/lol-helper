import { EventEmitter } from 'events'
import { createRequire } from 'module'

/**
 * Global, read-only keyboard listener used to notice when the scoreboard key
 * (Tab) is held in game, so the gold-difference widget can show alongside it.
 * It never blocks or injects input. The native module is optional: when it
 * is missing the app runs without the feature.
 */
export class KeyHook extends EventEmitter {
  available = false
  private tabDown = false

  start(): void {
    try {
      const req = createRequire(__filename)
      const { uIOhook, UiohookKey } = req('uiohook-napi') as typeof import('uiohook-napi')
      uIOhook.on('keydown', (e) => {
        if (e.keycode === UiohookKey.Tab && !this.tabDown) {
          this.tabDown = true
          this.emit('tab', true)
        }
      })
      uIOhook.on('keyup', (e) => {
        if (e.keycode === UiohookKey.Tab && this.tabDown) {
          this.tabDown = false
          this.emit('tab', false)
        }
      })
      uIOhook.start()
      this.available = true
    } catch (e) {
      console.warn('uiohook-napi unavailable, Tab detection disabled:', (e as Error).message)
    }
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
