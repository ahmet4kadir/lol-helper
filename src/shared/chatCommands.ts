/**
 * Parses a chat line like "mid flash", "top r", "bot nf", "jg tp" into a timer
 * request. Turkish and English shorthands are both accepted. Pure function, no
 * side effects; the overlay decides which enemy and slot it maps to.
 */

export interface ChatCommand {
  lane: 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'
  /** Summoner spell key (SummonerFlash…) or 'R' for the ultimate. */
  spell: string
}

const LANES: Record<string, ChatCommand['lane']> = {
  top: 'TOP',
  ust: 'TOP',
  üst: 'TOP',
  jg: 'JUNGLE',
  jng: 'JUNGLE',
  jung: 'JUNGLE',
  jungle: 'JUNGLE',
  orman: 'JUNGLE',
  mid: 'MIDDLE',
  orta: 'MIDDLE',
  bot: 'BOTTOM',
  adc: 'BOTTOM',
  alt: 'BOTTOM',
  ad: 'BOTTOM',
  sup: 'UTILITY',
  supp: 'UTILITY',
  support: 'UTILITY',
  destek: 'UTILITY',
  sp: 'UTILITY'
}

const SPELLS: Record<string, string> = {
  f: 'SummonerFlash',
  flash: 'SummonerFlash',
  flas: 'SummonerFlash',
  fla: 'SummonerFlash',
  flaş: 'SummonerFlash',
  nf: 'SummonerFlash',
  noflash: 'SummonerFlash',
  ign: 'SummonerDot',
  ignite: 'SummonerDot',
  tutustur: 'SummonerDot',
  tutuştur: 'SummonerDot',
  tp: 'SummonerTeleport',
  tele: 'SummonerTeleport',
  teleport: 'SummonerTeleport',
  exh: 'SummonerExhaust',
  exhaust: 'SummonerExhaust',
  heal: 'SummonerHeal',
  bar: 'SummonerBarrier',
  barrier: 'SummonerBarrier',
  ghost: 'SummonerHaste',
  hayalet: 'SummonerHaste',
  cleanse: 'SummonerBoost',
  smite: 'SummonerSmite',
  r: 'R',
  ult: 'R',
  ulti: 'R',
  ulit: 'R',
  ultimate: 'R'
}

export function parseChatCommand(text: string): ChatCommand | null {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length < 2 || words.length > 4) return null
  let lane: ChatCommand['lane'] | undefined
  let spell: string | undefined
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (!lane && LANES[w]) lane = LANES[w]
    else if (!spell && SPELLS[w]) spell = SPELLS[w]
    else if (!spell && w === 'no' && words[i + 1] && SPELLS[words[i + 1]]) {
      spell = SPELLS[words[i + 1]]
      i++
    }
  }
  return lane && spell ? { lane, spell } : null
}
