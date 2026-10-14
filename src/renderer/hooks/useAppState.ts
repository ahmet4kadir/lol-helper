import { useEffect, useState } from 'react'
import { initialAppState, type AppState } from '@shared/types'

/** Subscribes to the full app state pushed from the main process. */
export function useAppState(): AppState {
  const [state, setState] = useState<AppState>(initialAppState)
  useEffect(() => {
    let alive = true
    void window.helper.getState().then((s) => alive && setState(s))
    const off = window.helper.onState((s) => alive && setState(s))
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}

/** Version-less Data Dragon champion tile (works without knowing the patch). */
export function champIcon(key: string | undefined): string | undefined {
  return key ? `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${key}_0.jpg` : undefined
}
