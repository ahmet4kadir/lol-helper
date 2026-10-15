import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'

/**
 * Auto-update from GitHub Releases. The release workflow publishes the NSIS
 * installer plus `latest.yml`; electron-updater polls that, downloads in the
 * background and installs when the app quits (or immediately on request).
 * Only active in packaged builds.
 */
export function startUpdater(onStatus: (s: UpdateStatus) => void): { installNow: () => void; check: () => void } {
  if (!app.isPackaged) {
    onStatus({ state: 'disabled', version: app.getVersion() })
    return { installNow: () => {}, check: () => {} }
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  const v = app.getVersion()
  autoUpdater.on('checking-for-update', () => onStatus({ state: 'checking', version: v }))
  autoUpdater.on('update-not-available', () => onStatus({ state: 'up-to-date', version: v }))
  autoUpdater.on('update-available', (info) => onStatus({ state: 'downloading', version: v, next: info.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => onStatus({ state: 'downloading', version: v, percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => onStatus({ state: 'ready', version: v, next: info.version }))
  autoUpdater.on('error', (e) => onStatus({ state: 'error', version: v, error: e.message }))

  const check = () => void autoUpdater.checkForUpdates().catch(() => {})
  check()
  setInterval(check, 60 * 60 * 1000)

  return {
    // Silent install, relaunch when done.
    installNow: () => autoUpdater.quitAndInstall(true, true),
    check
  }
}
