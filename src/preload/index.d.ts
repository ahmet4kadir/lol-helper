import type { HelperApi } from './index'

declare global {
  interface Window {
    helper: HelperApi
  }
}

export {}
