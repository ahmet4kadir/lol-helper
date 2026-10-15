import { EventEmitter } from 'events'
import https from 'https'
import type { LiveSnapshot, LivePlayer } from '@shared/types'

/**
 * Polls Riot's official Live Client Data API, served by the game client at
 * https://127.0.0.1:2999 while a match is running. Read-only, allowed by Riot.
 */
export class LiveClient extends EventEmitter {
  private timer: NodeJS.Timeout | null = null
  private agent = new https.Agent({ rejectUnauthorized: false })
  private _connected = false

  get connected(): boolean {
    return this._connected
  }

  start(intervalMs = 1000): void {
    const tick = async () => {
      try {
        const raw = await this.fetchJson('/liveclientdata/allgamedata')
        const snap = parseAllGameData(raw)
        if (!this._connected) {
          this._connected = true
          this.emit('connected')
        }
        this.emit('snapshot', snap)
      } catch {
        if (this._connected) {
          this._connected = false
          this.emit('disconnected')
        }
      }
    }
    void tick()
    this.timer = setInterval(tick, intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private fetchJson(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.get({ host: '127.0.0.1', port: 2999, path, agent: this.agent, timeout: 800 }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`status ${res.statusCode}`))
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            reject(e)
          }
        })
      })
      req.on('timeout', () => req.destroy(new Error('timeout')))
      req.on('error', reject)
    })
  }
}

/**
 * Display names are localized ("Flaş", "Tutuştur"); rawDisplayName is not:
 * "GeneratedTip_SummonerSpell_SummonerFlash_DisplayName". Pull the Summoner* token.
 */
export function spellKey(sp: any): string {
  const raw: string = sp?.rawDisplayName ?? sp?.rawDescription ?? ''
  const m = /(Summoner[A-Za-z]+?)(?:_|$|DisplayName|Description)/.exec(raw.replace('GeneratedTip_SummonerSpell_', ''))
  if (m) return m[1].replace(/(DisplayName|Description)$/, '')
  // Fallback: English display name.
  const name: string = sp?.displayName ?? ''
  const byName: Record<string, string> = {
    Flash: 'SummonerFlash', Ignite: 'SummonerDot', Teleport: 'SummonerTeleport', Exhaust: 'SummonerExhaust', Heal: 'SummonerHeal',
    Barrier: 'SummonerBarrier', Cleanse: 'SummonerBoost', Ghost: 'SummonerHaste', Smite: 'SummonerSmite'
  }
  for (const [k, v] of Object.entries(byName)) if (name.includes(k)) return v
  return ''
}

export function parseAllGameData(raw: any): LiveSnapshot {
  const players: LivePlayer[] = (raw.allPlayers ?? []).map((p: any) => ({
    riotId: p.riotId ?? p.summonerName ?? '',
    championName: p.championName ?? '',
    rawChampionName: p.rawChampionName ?? '',
    team: p.team === 'CHAOS' ? 'CHAOS' : 'ORDER',
    position: p.position ?? '',
    level: p.level ?? 0,
    isDead: !!p.isDead,
    respawnTimer: p.respawnTimer ?? 0,
    items: (p.items ?? []).map((it: any) => ({
      itemID: it.itemID,
      displayName: it.displayName,
      price: it.price ?? 0,
      count: it.count ?? 1,
      slot: it.slot ?? 0
    })),
    kills: p.scores?.kills ?? 0,
    deaths: p.scores?.deaths ?? 0,
    assists: p.scores?.assists ?? 0,
    creepScore: p.scores?.creepScore ?? 0,
    wardScore: p.scores?.wardScore ?? 0,
    spell1: p.summonerSpells?.summonerSpellOne?.displayName ?? '',
    spell2: p.summonerSpells?.summonerSpellTwo?.displayName ?? '',
    spell1Key: spellKey(p.summonerSpells?.summonerSpellOne),
    spell2Key: spellKey(p.summonerSpells?.summonerSpellTwo)
  }))

  const ap = raw.activePlayer
  return {
    gameTime: raw.gameData?.gameTime ?? 0,
    gameMode: raw.gameData?.gameMode ?? '',
    mapNumber: raw.gameData?.mapNumber ?? 0,
    activePlayer: ap
      ? { riotId: ap.riotId ?? ap.summonerName ?? '', level: ap.level ?? 0, currentGold: ap.currentGold ?? 0 }
      : null,
    players,
    events: (raw.events?.Events ?? []).map((e: any) => ({
      ...e,
      id: e.EventID,
      name: e.EventName,
      time: e.EventTime
    }))
  }
}
