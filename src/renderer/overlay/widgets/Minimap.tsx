import { useEffect, useRef, useState } from 'react'
import type { ChampionInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { champIcon } from '../../hooks/useAppState'
import { fmtTime, lanePairs, mySide } from '../lanes'
import type { ReturnInfo } from '../useReturnTimers'
import type { Timer } from './SpellTimers'

type Pt = { x: number; y: number }

/**
 * Default anchors on the minimap, normalised 0..1 with origin at the
 * bottom-left (blue fountain). Every one of them can be dragged in edit mode;
 * the result is remembered per machine.
 */
const DEFAULT_ANCHORS: Record<string, Pt> = {
  TOP: { x: 0.2, y: 0.78 },
  MIDDLE: { x: 0.52, y: 0.52 },
  BOTTOM: { x: 0.78, y: 0.2 },
  UTILITY: { x: 0.86, y: 0.3 },
  JUNGLE_RED: { x: 0.64, y: 0.66 },
  JUNGLE_BLUE: { x: 0.36, y: 0.34 },
  FOUNTAIN_RED: { x: 0.95, y: 0.95 },
  FOUNTAIN_BLUE: { x: 0.05, y: 0.05 }
}

const LABEL: Record<string, string> = {
  TOP: 'top',
  MIDDLE: 'mid',
  BOTTOM: 'bot',
  UTILITY: 'sup',
  JUNGLE_RED: 'jg',
  JUNGLE_BLUE: 'jg',
  FOUNTAIN_RED: 'base',
  FOUNTAIN_BLUE: 'base'
}

function loadAnchors(): Record<string, Pt> {
  try {
    const raw = localStorage.getItem('minimap:anchors')
    if (raw) return { ...DEFAULT_ANCHORS, ...(JSON.parse(raw) as Record<string, Pt>) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_ANCHORS }
}

/** Waypoint in the middle of a lane path so icons follow the lane instead of cutting across. */
function waypoint(lane: string, from: Pt, to: Pt): Pt {
  if (lane === 'TOP') return { x: from.x, y: to.y }
  if (lane === 'BOTTOM' || lane === 'UTILITY') return { x: to.x, y: from.y }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
}

function along(lane: string, from: Pt, to: Pt, p: number): Pt {
  const mid = waypoint(lane, from, to)
  if (p < 0.5) {
    const q = p / 0.5
    return { x: from.x + (mid.x - from.x) * q, y: from.y + (mid.y - from.y) * q }
  }
  const q = (p - 0.5) / 0.5
  return { x: mid.x + (to.x - mid.x) * q, y: mid.y + (to.y - mid.y) * q }
}

/**
 * Transparent box the user places over the in-game minimap. In edit mode the
 * base and lane anchors are shown as draggable dots. Dead enemies sit greyed
 * in their fountain with the respawn countdown; once alive (or after a Recall)
 * the icon walks along its lane toward its anchor as the arrival countdown
 * runs. Spell cooldowns show next to the icon.
 */
export function Minimap({
  live,
  champions,
  info,
  timers,
  editMode
}: {
  live: LiveSnapshot
  champions: Record<number, ChampionInfo>
  info: Record<string, ReturnInfo>
  timers: Record<string, Timer>
  editMode: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const [anchors, setAnchors] = useState<Record<string, Pt>>(loadAnchors)
  const dragging = useRef<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem('minimap:anchors', JSON.stringify(anchors))
    } catch {
      /* ignore */
    }
  }, [anchors])

  const side = mySide(live)
  const champOf = (p: LivePlayer) => Object.values(champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
  const t = live.gameTime
  const fountainKey = side === 'ORDER' ? 'FOUNTAIN_RED' : 'FOUNTAIN_BLUE'
  const jungleKey = side === 'ORDER' ? 'JUNGLE_RED' : 'JUNGLE_BLUE'
  const fountain = anchors[fountainKey]
  const enemies = lanePairs(live)
    .map((x) => ({ lane: x.lane, p: x.enemy }))
    .filter((x): x is { lane: string; p: LivePlayer } => !!x.p)

  const toNorm = (clientX: number, clientY: number): Pt => {
    const r = box.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height))
    }
  }
  const onDown = (key: string) => (e: React.PointerEvent) => {
    if (!editMode) return
    e.stopPropagation()
    dragging.current = key
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const k = dragging.current
    setAnchors((a) => ({ ...a, [k]: toNorm(e.clientX, e.clientY) }))
  }
  const onUp = () => {
    dragging.current = null
  }

  const editKeys = ['TOP', jungleKey, 'MIDDLE', 'BOTTOM', 'UTILITY', fountainKey]

  return (
    <div ref={box} className={`minimap ${editMode ? 'calibrating' : ''}`}>
      {editMode && (
        <>
          <div className="minimap-hint">Fit the box to the minimap, then drag the dots: base + lanes</div>
          <button className="close mm-reset" onPointerDown={(e) => e.stopPropagation()} onClick={() => setAnchors({ ...DEFAULT_ANCHORS })} title="Reset anchors">
            reset
          </button>
          {editKeys.map((key) => {
            const a = anchors[key]
            return (
              <div
                key={key}
                className={`mm-anchor ${key.startsWith('FOUNTAIN') ? 'base' : ''}`}
                style={{ left: `${a.x * 100}%`, top: `${(1 - a.y) * 100}%` }}
                onPointerDown={onDown(key)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                title={`drag: ${LABEL[key]}`}
              >
                {LABEL[key]}
              </div>
            )
          })}
        </>
      )}
      {enemies.map(({ lane, p }) => {
        const key = lane === 'JUNGLE' ? jungleKey : lane
        const target = anchors[key] ?? DEFAULT_ANCHORS.MIDDLE
        const c = champOf(p)
        const r = info[p.riotId]
        const down: string[] = []
        for (const slot of ['1', '2', 'R']) {
          const tm = timers[`${p.riotId}:${slot}`]
          if (tm && tm.end > t) down.push(`${slot === '1' ? 'D' : slot === '2' ? 'F' : 'R'} ${fmtTime(tm.end - t)}`)
        }
        if (!r && down.length === 0) return null
        const pos = r ? (r.dead ? fountain : along(lane, fountain, target, r.progress)) : target
        return (
          <div
            key={p.riotId}
            className={`mm-marker ${r ? (r.dead ? 'dead' : 'returning') : ''}`}
            style={{ left: `${pos.x * 100}%`, top: `${(1 - pos.y) * 100}%` }}
          >
            {c ? <img src={champIcon(c.key)} alt="" /> : <span className="noimg" />}
            <div className="mm-text mono">
              {r && <div>{r.dead ? `☠ ${fmtTime(r.respawnIn)}` : `→ ${fmtTime(r.laneIn)}`}</div>}
              {down.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
