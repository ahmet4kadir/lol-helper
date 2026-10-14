/**
 * Where on-disk caches live. Set once by the Electron entry point; the data
 * and stats modules only import this, so they stay free of Electron and can
 * be reused by a plain Node service or a web backend.
 */
let dir = ''

export function setCacheDir(d: string): void {
  dir = d
}

export function cacheDir(): string {
  if (!dir) throw new Error('cache dir not set')
  return dir
}
