import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Pos {
  x: number
  y: number
}

function loadPos(id: string, fallback: Pos): Pos {
  try {
    const raw = localStorage.getItem(`widget:${id}`)
    if (raw) return JSON.parse(raw) as Pos
  } catch {
    /* ignore */
  }
  return fallback
}

function savePos(id: string, p: Pos): void {
  try {
    localStorage.setItem(`widget:${id}`, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/**
 * A movable overlay card. Drag by the title bar in edit mode; position is
 * remembered per widget id. While the cursor is over a widget the overlay
 * captures the mouse; elsewhere clicks fall through to the game.
 */
export function Widget({
  id,
  title,
  editMode,
  defaultPos,
  onClose,
  className,
  interactive,
  children
}: {
  id: string
  title: string
  editMode: boolean
  defaultPos: Pos
  onClose?: () => void
  className?: string
  /** Captures the mouse even in locked mode, for widgets with buttons (timers). */
  interactive?: boolean
  children: ReactNode
}) {
  const [pos, setPos] = useState<Pos>(() => loadPos(id, defaultPos))
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  useEffect(() => savePos(id, pos), [id, pos])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editMode || e.button !== 0) return
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPos({ x: Math.max(0, e.clientX - drag.current.dx), y: Math.max(0, e.clientY - drag.current.dy) })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div
      className={`widget ${editMode ? '' : 'locked'} ${className ?? ''}`}
      style={{ left: pos.x, top: pos.y }}
      onMouseEnter={() => (editMode || interactive) && window.helper.setOverlayIgnoreMouse(false)}
      onMouseLeave={() => !drag.current && window.helper.setOverlayIgnoreMouse(true)}
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
          <span className="handle-actions">
            <span>⠿</span>
            {onClose && (
              <button className="close" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Hide widget">
                ×
              </button>
            )}
          </span>
        )}
      </div>
      <div className="body">{children}</div>
    </div>
  )
}
