import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Pos {
  x: number
  y: number
}
interface Size {
  w: number
  h: number
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* ignore */
  }
  return fallback
}

function save(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function loadScale(id: string): number {
  return load(`widget:scale:${id}`, 1)
}

/**
 * A movable overlay card. Drag by the title bar in edit mode; position, size
 * and scale are remembered per widget id. While the cursor is over a widget the
 * overlay captures the mouse; elsewhere clicks fall through to the game.
 */
export function Widget({
  id,
  title,
  editMode,
  defaultPos,
  defaultSize,
  resizable,
  globalScale = 1,
  onClose,
  className,
  interactive,
  children
}: {
  id: string
  title: string
  editMode: boolean
  defaultPos: Pos
  defaultSize?: Size
  /** Shows a corner handle in edit mode; size is remembered. */
  resizable?: boolean
  globalScale?: number
  onClose?: () => void
  className?: string
  /** Captures the mouse even in locked mode, for widgets with buttons (timers). */
  interactive?: boolean
  children: ReactNode
}) {
  const [pos, setPos] = useState<Pos>(() => load(`widget:${id}`, defaultPos))
  const [size, setSize] = useState<Size | null>(() => (defaultSize ? load(`widget:size:${id}`, defaultSize) : null))
  const [scale, setScale] = useState<number>(() => loadScale(id))
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => save(`widget:${id}`, pos), [id, pos])
  useEffect(() => {
    if (size) save(`widget:size:${id}`, size)
  }, [id, size])
  useEffect(() => save(`widget:scale:${id}`, scale), [id, scale])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editMode || e.button !== 0) return
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPos({
      x: Math.min(window.innerWidth - 20, Math.max(-200, e.clientX - drag.current.dx)),
      y: Math.min(window.innerHeight - 20, Math.max(0, e.clientY - drag.current.dy))
    })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const onResizeDown = (e: React.PointerEvent) => {
    if (!editMode || !size) return
    e.stopPropagation()
    resize.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resize.current) return
    const z = scale * globalScale
    setSize({
      w: Math.max(60, resize.current.w + (e.clientX - resize.current.x) / z),
      h: Math.max(40, resize.current.h + (e.clientY - resize.current.y) / z)
    })
  }
  const onResizeUp = () => {
    resize.current = null
  }

  const zoom = Math.max(0.4, Math.min(2, scale * globalScale))
  const bump = (d: number) => setScale((s) => Math.max(0.5, Math.min(1.6, Math.round((s + d) * 100) / 100)))

  return (
    <div
      className={`widget ${editMode ? '' : 'locked'} ${className ?? ''}`}
      style={{ left: pos.x, top: pos.y, zoom, ...(size ? { width: size.w, height: size.h } : {}) }}
      onMouseEnter={() => (editMode || interactive) && window.helper.setOverlayIgnoreMouse(false)}
      onMouseLeave={() => !drag.current && !resize.current && window.helper.setOverlayIgnoreMouse(true)}
    >
      <div
        className="handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span>{title}</span>
        {editMode && (
          <span className="handle-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => bump(-0.1)} title="Smaller">
              −
            </button>
            <span className="muted" style={{ fontSize: 10 }}>
              {Math.round(scale * 100)}%
            </span>
            <button className="close" onClick={() => bump(0.1)} title="Bigger">
              +
            </button>
            <span>⠿</span>
            {onClose && (
              <button className="close" onClick={onClose} title="Hide widget">
                ×
              </button>
            )}
          </span>
        )}
      </div>
      <div className="body">{children}</div>
      {resizable && editMode && (
        <div className="resize-handle" onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp} title="Resize" />
      )}
    </div>
  )
}
