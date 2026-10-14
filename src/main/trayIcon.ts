import { nativeImage } from 'electron'

// 32x32 PNG, gold "L" on a dark rounded square. Inlined so packaging needs no extra resources.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAsUlEQVR4nGNgGGDAiEvixKq8/9S0yCJsEla7MASpbTEhh6BwkC13TllGVYv3zonC6ggmeliObiayXUz4FNLSESgOgLmIlpajOwJmJwsxmpDjD90gSgFGFNAbjDpg1AGjDhh1wKgDBtwBRFVG2AC2CgobIFRpDXgIjDpgwB1AVCKkZVONiYEB0UwmNmVTAmB2wOzEiAJaOgKb2XAHIHcWaOEIXB2TwdU1o6VDcHVOBxwAANfzQIuOiwA3AAAAAElFTkSuQmCC'

export function trayIcon() {
  return nativeImage.createFromDataURL(`data:image/png;base64,${PNG_BASE64}`)
}
