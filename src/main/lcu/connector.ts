import { EventEmitter } from 'events'
import { execFile } from 'child_process'
import { readFile } from 'fs/promises'
import https from 'https'
import WebSocket from 'ws'

/**
 * Connects to the League Client (LCU) local REST + WebSocket API.
 *
 * The client exposes `https://127.0.0.1:<port>` with HTTP basic auth
 * (user "riot", password = remoting auth token) and a self-signed cert.
 * Credentials are discovered from the LeagueClientUx process command line,
 * falling back to the `lockfile` in the install directory.
 */

export interface LcuCredentials {
  port: number
  password: string
}

export interface LcuEvent<T = unknown> {
  uri: string
  eventType: 'Create' | 'Update' | 'Delete'
  data: T
}

const LOCKFILE_CANDIDATES = [
  'C:\\Riot Games\\League of Legends\\lockfile',
  'D:\\Riot Games\\League of Legends\\lockfile',
  '/Applications/League of Legends.app/Contents/LoL/lockfile'
]

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout) => {
      resolve(err ? '' : String(stdout))
    })
  })
}

async function fromProcessList(): Promise<LcuCredentials | null> {
  let out = ''
  if (process.platform === 'win32') {
    out = await run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine"
    ])
  } else {
    out = await run('ps', ['-A', '-o', 'args'])
  }
  const port = /--app-port=(\d+)/.exec(out)?.[1]
  const password = /--remoting-auth-token=([\w-]+)/.exec(out)?.[1]
  if (port && password) return { port: Number(port), password }
  return null
}

async function fromLockfile(): Promise<LcuCredentials | null> {
  for (const p of LOCKFILE_CANDIDATES) {
    try {
      const txt = await readFile(p, 'utf8')
      // LeagueClient:PID:PORT:PASSWORD:PROTOCOL
      const parts = txt.trim().split(':')
      if (parts.length >= 5) return { port: Number(parts[2]), password: parts[3] }
    } catch {
      /* not there */
    }
  }
  return null
}

export async function discoverCredentials(): Promise<LcuCredentials | null> {
  return (await fromProcessList()) ?? (await fromLockfile())
}

export class LcuConnector extends EventEmitter {
  private creds: LcuCredentials | null = null
  private ws: WebSocket | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private agent = new https.Agent({ rejectUnauthorized: false })
  private subscriptions = new Set<string>()

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  start(pollMs = 2000): void {
    const tick = async () => {
      if (!this.connected) await this.tryConnect()
    }
    void tick()
    this.pollTimer = setInterval(tick, pollMs)
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.ws?.close()
  }

  /** Subscribe to an LCU event, e.g. "/lol-champ-select/v1/session". */
  subscribe(uri: string): void {
    this.subscriptions.add(uri)
    if (this.connected) this.sendSubscribe(uri)
  }

  private eventName(uri: string): string {
    return 'OnJsonApiEvent' + uri.replace(/\//g, '_')
  }

  private sendSubscribe(uri: string): void {
    this.ws?.send(JSON.stringify([5, this.eventName(uri)]))
  }

  private async tryConnect(): Promise<void> {
    const creds = await discoverCredentials()
    if (!creds) return
    this.creds = creds
    // Make sure the REST API answers before opening the socket.
    try {
      await this.request('GET', '/lol-gameflow/v1/gameflow-phase')
    } catch {
      return
    }
    await this.openSocket()
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.creds) return resolve()
      const { port, password } = this.creds
      const ws = new WebSocket(`wss://127.0.0.1:${port}`, {
        rejectUnauthorized: false,
        headers: { Authorization: this.authHeader(password) }
      })
      ws.on('open', () => {
        this.ws = ws
        for (const uri of this.subscriptions) this.sendSubscribe(uri)
        this.emit('connected')
        resolve()
      })
      ws.on('message', (raw) => {
        let msg: unknown
        try {
          msg = JSON.parse(raw.toString())
        } catch {
          return
        }
        if (!Array.isArray(msg) || msg[0] !== 8) return
        const payload = msg[2] as LcuEvent
        if (payload?.uri) this.emit('event', payload)
      })
      ws.on('close', () => {
        this.ws = null
        this.emit('disconnected')
      })
      ws.on('error', () => {
        /* close follows */
        resolve()
      })
    })
  }

  private authHeader(password: string): string {
    return 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
  }

  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.creds) return reject(new Error('LCU not connected'))
      const { port, password } = this.creds
      const data = body === undefined ? undefined : JSON.stringify(body)
      const req = https.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          agent: this.agent,
          headers: {
            Authorization: this.authHeader(password),
            Accept: 'application/json',
            ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
          }
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => {
            const txt = Buffer.concat(chunks).toString('utf8')
            if ((res.statusCode ?? 500) >= 400) return reject(new Error(`LCU ${method} ${path} -> ${res.statusCode}: ${txt}`))
            if (!txt) return resolve(undefined as T)
            try {
              resolve(JSON.parse(txt) as T)
            } catch {
              resolve(txt as unknown as T)
            }
          })
        }
      )
      req.on('error', reject)
      if (data) req.write(data)
      req.end()
    })
  }
}
