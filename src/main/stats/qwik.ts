/**
 * Lolalytics pages are server-rendered with Qwik, which serialises component
 * state into `<script type="qwik/json">{ objs: [...] }</script>`. Values that
 * look like short base-36 strings are references into `objs`. These helpers
 * pull the blob out of a page and resolve references into plain objects.
 */

export interface QwikState {
  objs: unknown[]
}

export function extractQwikState(html: string): QwikState {
  const m = /<script type="qwik\/json">([\s\S]*?)<\/script>/.exec(html)
  if (!m) throw new Error('qwik/json state not found (site changed?)')
  return JSON.parse(m[1]) as QwikState
}

export function makeResolver(objs: unknown[], maxDepth = 10): (v: unknown) => unknown {
  const isRef = (v: unknown): v is string =>
    typeof v === 'string' && /^[0-9a-z]{1,4}$/.test(v) && objs[parseInt(v, 36)] !== undefined
  const resolve = (v: unknown, depth: number): unknown => {
    if (depth > maxDepth) return v
    if (isRef(v)) return resolve(objs[parseInt(v, 36)], depth + 1)
    if (Array.isArray(v)) return v.map((x) => resolve(x, depth + 1))
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = resolve(x, depth + 1)
      return out
    }
    return v
  }
  return (v) => resolve(v, 0)
}

/** Plain objects in `objs` that have every one of `keys`. */
export function findObjects(objs: unknown[], keys: string[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const v of objs) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const o = v as Record<string, unknown>
    if (keys.every((k) => k in o)) out.push(o)
  }
  return out
}

export function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Accept: 'text/html'
}
