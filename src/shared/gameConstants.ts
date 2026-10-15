/**
 * Summoner's Rift timings in seconds. Riot changes these between seasons,
 * adjust here when a patch moves them.
 */

export interface CampDef {
  id: string
  label: string
  short: string
  firstSpawn: number
  respawn: number
  side: 'blue' | 'red' | 'river'
}

export const CAMPS: CampDef[] = [
  { id: 'blue-blue', label: 'Blue buff (blue side)', short: 'Blue', firstSpawn: 90, respawn: 300, side: 'blue' },
  { id: 'blue-red', label: 'Red buff (blue side)', short: 'Red', firstSpawn: 90, respawn: 300, side: 'blue' },
  { id: 'blue-gromp', label: 'Gromp (blue side)', short: 'Gromp', firstSpawn: 90, respawn: 135, side: 'blue' },
  { id: 'blue-wolves', label: 'Wolves (blue side)', short: 'Wolves', firstSpawn: 90, respawn: 135, side: 'blue' },
  { id: 'blue-raptors', label: 'Raptors (blue side)', short: 'Raptors', firstSpawn: 90, respawn: 135, side: 'blue' },
  { id: 'blue-krugs', label: 'Krugs (blue side)', short: 'Krugs', firstSpawn: 90, respawn: 135, side: 'blue' },
  { id: 'red-blue', label: 'Blue buff (red side)', short: 'Blue', firstSpawn: 90, respawn: 300, side: 'red' },
  { id: 'red-red', label: 'Red buff (red side)', short: 'Red', firstSpawn: 90, respawn: 300, side: 'red' },
  { id: 'red-gromp', label: 'Gromp (red side)', short: 'Gromp', firstSpawn: 90, respawn: 135, side: 'red' },
  { id: 'red-wolves', label: 'Wolves (red side)', short: 'Wolves', firstSpawn: 90, respawn: 135, side: 'red' },
  { id: 'red-raptors', label: 'Raptors (red side)', short: 'Raptors', firstSpawn: 90, respawn: 135, side: 'red' },
  { id: 'red-krugs', label: 'Krugs (red side)', short: 'Krugs', firstSpawn: 90, respawn: 135, side: 'red' },
  { id: 'scuttle-top', label: 'Scuttle (top river)', short: 'Scuttle T', firstSpawn: 210, respawn: 150, side: 'river' },
  { id: 'scuttle-bot', label: 'Scuttle (bot river)', short: 'Scuttle B', firstSpawn: 210, respawn: 150, side: 'river' }
]

export interface ObjectiveDef {
  id: string
  label: string
  firstSpawn: number
  respawn: number
  /** Live Client event name that marks a kill. */
  killEvent: string
  /** Stop showing after this game time (e.g. herald despawns). */
  until?: number
}

export const OBJECTIVES: ObjectiveDef[] = [
  { id: 'dragon', label: 'Dragon', firstSpawn: 300, respawn: 300, killEvent: 'DragonKill' },
  { id: 'grubs', label: 'Void Grubs', firstSpawn: 480, respawn: 240, killEvent: 'HordeKill', until: 840 },
  { id: 'herald', label: 'Rift Herald', firstSpawn: 960, respawn: 0, killEvent: 'HeraldKill', until: 1500 },
  { id: 'atakhan', label: 'Atakhan', firstSpawn: 1200, respawn: 0, killEvent: 'AtakhanKill' },
  { id: 'baron', label: 'Baron', firstSpawn: 1500, respawn: 360, killEvent: 'BaronKill' }
]

/** Summoner spell base cooldowns (seconds), keyed by Riot's spell key (language independent). */
export const SUMMONER_CD: Record<string, number> = {
  SummonerFlash: 300,
  SummonerDot: 180, // Ignite
  SummonerTeleport: 360,
  SummonerExhaust: 210,
  SummonerHeal: 240,
  SummonerBarrier: 180,
  SummonerBoost: 210, // Cleanse
  SummonerHaste: 210, // Ghost
  SummonerSmite: 90
}
export const SUMMONER_LABEL: Record<string, string> = {
  SummonerFlash: 'Flash',
  SummonerDot: 'Ignite',
  SummonerTeleport: 'TP',
  SummonerExhaust: 'Exhaust',
  SummonerHeal: 'Heal',
  SummonerBarrier: 'Barrier',
  SummonerBoost: 'Cleanse',
  SummonerHaste: 'Ghost',
  SummonerSmite: 'Smite'
}

/** Summoner spell haste sources. CD = base × 100 / (100 + haste). */
export const SUMMONER_HASTE = {
  ionianBoots: 12, // item 3158
  cosmicInsight: 18 // rune 8347, not visible for enemies, toggled manually
}
export const IONIAN_BOOTS_ID = 3158

/** Base-to-lane timer. Distances are approximate path lengths in game units from the fountain. */
export const RECALL_SEC = 8
/** Homeguard: bonus move speed on leaving the fountain, decaying linearly to 0 over HOMEGUARD_DECAY_SEC. */
export const HOMEGUARD_PCT = 0.75
export const HOMEGUARD_DECAY_SEC = 8
export const LANE_DISTANCE: Record<string, number> = {
  TOP: 10000,
  JUNGLE: 7500,
  MIDDLE: 8100,
  BOTTOM: 10100,
  UTILITY: 10100
}

/** Each destroyed turret tier moves the lane front by about this many units. */
export const TURRET_STEP = 1800

/** Movement speed by boots item id, for the base-to-lane timer. */
export const BOOTS_MS: Record<number, number> = {
  1001: 25, // Boots
  3006: 45, // Berserker's Greaves
  3009: 55, // Swiftness
  3020: 45, // Sorcerer's Shoes
  3047: 45, // Plated Steelcaps
  3111: 45, // Mercury's Treads
  3117: 45, // Mobility -> Ionian base
  3158: 45 // Ionian Boots of Lucidity
}
