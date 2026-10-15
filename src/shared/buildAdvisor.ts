import type { ChampBuild, ChampionInfo, ItemInfo, LivePlayer } from './types'

/**
 * In-game "buy this next" advice. Combines:
 *  - the champion's meta build (core order, situational options with win rates),
 *  - what the enemies have actually bought (Data Dragon item tags),
 *  - the enemy composition (damage types, sustain, assassins, tanks, CC).
 * Items are looked up by name so the rules survive id changes between patches;
 * a rule is skipped when its item does not exist in the current data.
 */

export interface BuildSuggestion {
  itemId: number
  name: string
  gold: number
  reason: string
  /** 'core' = next item of the meta build, 'counter' = situational, 'option' = meta 4th-6th option. */
  kind: 'core' | 'counter' | 'option'
  winRate?: number
  affordable: boolean
}

const ARMOR_TAG = 'Armor'
const MR_TAG = 'SpellBlock'

function byName(items: Record<number, ItemInfo>): Map<string, ItemInfo> {
  const m = new Map<string, ItemInfo>()
  for (const it of Object.values(items)) if (it.final) m.set(it.name.toLowerCase(), it)
  return m
}

function find(names: Map<string, ItemInfo>, ...candidates: string[]): ItemInfo | undefined {
  for (const n of candidates) {
    const it = names.get(n.toLowerCase())
    if (it) return it
  }
  return undefined
}

function owns(me: LivePlayer, id: number): boolean {
  return me.items.some((i) => i.itemID === id)
}

function hasTag(p: LivePlayer, items: Record<number, ItemInfo>, tag: string, minGold = 800): number {
  return p.items.filter((i) => {
    const it = items[i.itemID]
    return it && it.gold >= minGold && it.tags.includes(tag)
  }).length
}

export interface AdvisorInput {
  me: LivePlayer
  myChamp: ChampionInfo | undefined
  myGold: number
  enemies: LivePlayer[]
  enemyChamps: (ChampionInfo | undefined)[]
  build: ChampBuild | null
  items: Record<number, ItemInfo>
}

export function adviseBuild(input: AdvisorInput): BuildSuggestion[] {
  const { me, myChamp, myGold, enemies, enemyChamps, build, items } = input
  const names = byName(items)
  const out: BuildSuggestion[] = []
  const push = (it: ItemInfo | undefined, reason: string, kind: BuildSuggestion['kind'], winRate?: number) => {
    if (!it || owns(me, it.id) || out.some((o) => o.itemId === it.id)) return
    out.push({ itemId: it.id, name: it.name, gold: it.gold, reason, kind, winRate, affordable: myGold >= it.gold })
  }

  const dmg = myChamp?.damageType ?? 'Unknown'
  const isAP = dmg === 'AP'
  const isAD = dmg === 'AD' || dmg === 'Mixed'
  const tags = myChamp?.compTags ?? []
  const isTank = tags.includes('tank')
  const isMarksman = myChamp?.tags.includes('Marksman') ?? false
  const isSquishy = !isTank && !tags.includes('sustain')

  // ---- enemy facts
  const champs = enemyChamps.filter((c): c is ChampionInfo => !!c)
  const enemyAD = champs.filter((c) => c.damageType === 'AD').length + champs.filter((c) => c.damageType === 'Mixed').length * 0.5
  const enemyAP = champs.filter((c) => c.damageType === 'AP').length + champs.filter((c) => c.damageType === 'Mixed').length * 0.5
  const healers = champs.filter((c) => c.compTags.includes('sustain') || c.compTags.includes('enchanter'))
  const assassins = champs.filter((c) => c.compTags.includes('assassin'))
  const tanks = champs.filter((c) => c.compTags.includes('tank'))
  const cc = champs.filter((c) => c.compTags.includes('cc')).length
  const armorItems = enemies.reduce((a, p) => a + hasTag(p, items, ARMOR_TAG), 0)
  const mrItems = enemies.reduce((a, p) => a + hasTag(p, items, MR_TAG), 0)
  const lifestealItems = enemies.reduce((a, p) => a + hasTag(p, items, 'LifeSteal'), 0)
  const critItems = enemies.reduce((a, p) => a + hasTag(p, items, 'CriticalStrike'), 0)
  const asItems = enemies.reduce((a, p) => a + hasTag(p, items, 'AttackSpeed'), 0)
  const hpItems = enemies.reduce((a, p) => a + hasTag(p, items, 'Health', 2500), 0)
  const fedEnemy = enemies.reduce((best, p) => (p.kills > best.kills ? p : best), enemies[0])

  // ---- 1) next core item from the meta build
  if (build) {
    const next = build.core.ids.find((id) => !owns(me, id) && items[id])
    if (next) push(items[next], `next core item (${build.core.winRate.toFixed(0)}% win rate build)`, 'core', build.core.winRate)
  }

  // ---- 2) boots
  const hasBoots = me.items.some((i) => items[i.itemID]?.tags.includes('Boots'))
  if (!hasBoots && me.level >= 5) {
    if (enemyAP >= 3 || cc >= 3) push(find(names, "Mercury's Treads"), enemyAP >= 3 ? `${Math.round(enemyAP)} AP enemies` : 'lots of enemy CC', 'counter')
    else if (enemyAD >= 3 && (isSquishy || isTank)) push(find(names, 'Plated Steelcaps'), `${Math.round(enemyAD)} AD enemies`, 'counter')
  }

  // ---- 3) anti-heal
  if (healers.length >= 1 || lifestealItems >= 2) {
    const why = healers.length ? `healing from ${healers.map((c) => c.name).join(', ')}` : `${lifestealItems} lifesteal items on enemies`
    if (isAP) push(find(names, 'Morellonomicon', 'Oblivion Orb'), why, 'counter')
    else if (isAD) push(find(names, 'Mortal Reminder', "Executioner's Calling", 'Chempunk Chainsword'), why, 'counter')
    else if (isTank) push(find(names, 'Thornmail', 'Bramble Vest'), why, 'counter')
  }

  // ---- 4) penetration vs resist stacking
  if (isAD && (armorItems >= 2 || tanks.length >= 2)) {
    push(find(names, "Lord Dominik's Regards", "Serylda's Grudge", 'Mortal Reminder'), armorItems >= 2 ? `${armorItems} armor items on enemies` : `${tanks.length} enemy tanks`, 'counter')
  }
  if (isAP && (mrItems >= 2 || tanks.length >= 2)) {
    push(find(names, 'Void Staff', 'Cryptbloom'), mrItems >= 2 ? `${mrItems} MR items on enemies` : `${tanks.length} enemy tanks`, 'counter')
  }
  if ((isAD || isAP) && hpItems >= 2 && !isMarksman) {
    push(isAP ? find(names, "Liandry's Torment", 'Blackfire Torch') : find(names, 'Blade of The Ruined King', 'Kraken Slayer'), `${hpItems} big HP items on enemies`, 'counter')
  }

  // ---- 5) survive the threat
  const fedIsAD = fedEnemy && enemyChamps[enemies.indexOf(fedEnemy)]?.damageType !== 'AP'
  if (isSquishy) {
    if (assassins.length >= 2 || (fedEnemy && fedEnemy.kills >= 5 && assassins.length >= 1)) {
      if (isAP) push(find(names, "Zhonya's Hourglass"), `${assassins.map((c) => c.name).join(', ')} diving you`, 'counter')
      else push(find(names, 'Guardian Angel', "Death's Dance", 'Edge of Night'), `${assassins.map((c) => c.name).join(', ')} diving you`, 'counter')
    } else if (fedEnemy && fedEnemy.kills >= 6) {
      if (fedIsAD) push(isAP ? find(names, "Zhonya's Hourglass") : find(names, 'Guardian Angel', "Death's Dance"), `${fedEnemy.championName} is ${fedEnemy.kills}/${fedEnemy.deaths}`, 'counter')
      else push(isAP ? find(names, "Banshee's Veil") : find(names, 'Maw of Malmortius', 'Wit\'s End'), `${fedEnemy.championName} is ${fedEnemy.kills}/${fedEnemy.deaths}`, 'counter')
    }
    if (enemyAP >= 3 && me.level >= 9) push(isAP ? find(names, "Banshee's Veil") : find(names, 'Maw of Malmortius'), `${Math.round(enemyAP)} AP damage dealers`, 'counter')
  }
  if (isMarksman && cc >= 3) push(find(names, 'Quicksilver Sash', 'Mercurial Scimitar'), `${cc} enemies with hard CC`, 'counter')

  // ---- 6) tank itemisation
  if (isTank) {
    if (critItems >= 2) push(find(names, "Randuin's Omen"), `${critItems} crit items on enemies`, 'counter')
    if (asItems >= 2) push(find(names, 'Frozen Heart'), `${asItems} attack speed items on enemies`, 'counter')
    if (enemyAP >= 3) push(find(names, 'Force of Nature', 'Spirit Visage', 'Kaenic Rookern'), `${Math.round(enemyAP)} AP enemies`, 'counter')
    if (enemyAD >= 3) push(find(names, 'Sunfire Aegis', "Jak'Sho, The Protean", 'Thornmail'), `${Math.round(enemyAD)} AD enemies`, 'counter')
  }

  // ---- 7) meta options for the next slot, as fallbacks
  if (build) {
    const slot = me.items.filter((i) => items[i.itemID]?.final && !items[i.itemID]?.tags.includes('Boots') && items[i.itemID]!.gold >= 2000).length
    const pool = slot <= 3 ? build.item4 : slot === 4 ? build.item5 : build.item6
    for (const o of pool.slice(0, 3)) push(items[o.id], `meta ${slot + 1}th item, ${o.winRate.toFixed(0)}% win rate`, 'option', o.winRate)
  }

  // Core first, then counters by relevance order they were pushed, then options. Cap at 5.
  const order = { core: 0, counter: 1, option: 2 }
  return out.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 5)
}
