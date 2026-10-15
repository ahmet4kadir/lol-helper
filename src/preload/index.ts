import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppState, type MatchDetail } from '@shared/types'

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke(IPC.getState),
  onState: (cb: (s: AppState) => void): (() => void) => {
    const handler = (_e: unknown, s: AppState) => cb(s)
    ipcRenderer.on(IPC.state, handler)
    return () => ipcRenderer.removeListener(IPC.state, handler)
  },
  setOverlayEditMode: (edit: boolean): void => ipcRenderer.send(IPC.setOverlayEditMode, edit),
  setOverlayIgnoreMouse: (ignore: boolean): void => ipcRenderer.send(IPC.setOverlayIgnoreMouse, ignore),
  openControl: (): void => ipcRenderer.send(IPC.openControl),
  sendChampSelectChat: (body: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.sendChampSelectChat, body),
  refreshMeta: (): void => ipcRenderer.send(IPC.refreshMeta),
  champSelectAction: (championId: number, lock: boolean): Promise<{ ok: boolean; type?: string; error?: string }> =>
    ipcRenderer.invoke(IPC.champSelectAction, championId, lock),
  lookupPlayer: (riotId: string): Promise<{ ok: boolean; puuid?: string; error?: string }> => ipcRenderer.invoke(IPC.lookupPlayer, riotId),
  getMatch: (gameId: number): Promise<{ ok: boolean; match?: MatchDetail; error?: string }> => ipcRenderer.invoke(IPC.getMatch, gameId),
  onChatCommand: (cb: (text: string) => void): (() => void) => {
    const handler = (_e: unknown, text: string) => cb(text)
    ipcRenderer.on(IPC.chatCommand, handler)
    return () => ipcRenderer.removeListener(IPC.chatCommand, handler)
  },
  onTabClick: (cb: (pt: { x: number; y: number }) => void): (() => void) => {
    const handler = (_e: unknown, pt: { x: number; y: number }) => cb(pt)
    ipcRenderer.on(IPC.tabClick, handler)
    return () => ipcRenderer.removeListener(IPC.tabClick, handler)
  },
  installUpdate: (): void => ipcRenderer.send(IPC.installUpdate),
  checkUpdate: (): void => ipcRenderer.send(IPC.checkUpdate)
}

export type HelperApi = typeof api

contextBridge.exposeInMainWorld('helper', api)
