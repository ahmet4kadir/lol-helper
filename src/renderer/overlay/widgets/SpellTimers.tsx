import { useEffect, useState } from 'react'
import type { ChampionDetail, ChampionInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { IONIAN_BOOTS_ID, SUMMONER_CD, SUMMONER_HASTE } from '@shared/gameConstants'
import { champIcon } from '../../hooks/useAppState'
import { fmtTime, lanePairs, LANE_SHORT } from '../lanes'

const DD = 'https://ddragon.leagueoflegends.com/cdn'
const SPELL_KEY: Record<string, string> = {
  Flash: 'SummonerFlash',
  Ignite: 'SummonerDot',
  Teleport: 'SummonerTeleport',
  Exhaust: 'SummonerExhaust',
  Heal: 'SummonerHeal',
  Barrier: 'SummonerBarrier',
  Cleanse: 'SummonerBoost',
  Ghost: 'SummonerHaste',
  Smite: 'SummonerSmite'
}

/** "Unleashed Teleport" -> "Teleport", "Primal Smite" -> "Smite". */
function baseSpell(displayName: string): string {
  for (const k of Object.keys(SUMMONER_CD)) if (displayName.includes(k)) return k
  return displayName
}

function spellCooldown(displayName: string, p: LivePlayer, cosmic: boolean): number {
  const name = baseSpell(displayName)
  let base = SUMMONER_CD[name] ?? 0
  if (displayName.includes('Unleashed')) base = 240
  let haste = 0
  if (p.items.some((i) => i.itemID === IONIAN_BOOTS_ID)) haste += SUMMONER_HASTE.ionianBoots
  if (cosmic) haste += SUMMONER_HASTE.cosmicInsight
  return Math.round((base * 100) / (100 + haste))
}

function ultCooldown(p: LivePlayer, d?: ChampionDetail): number {
  if (!d || d.ultCooldown.length === 0) return 0
  const rank = p.level >= 16 ? 3 : p.level >= 11 ? 2 : p.level >= 6 ? 1 : 0
  if (rank === 0) return 0
  return d.ultCooldown[Math.min(rank, d.ultCooldown.length) - 1]
}

interface Timer {
  end: number // game time at which it is back up
  total: number
}

/**
 * Enemy summoner spell and ultimate timers. Click when you see the spell go:
 * the cooldown is computed from the spell, the enemy's boots and level, and
 * the optional Cosmic Insight toggle. Click a running timer to clear it.
 */
export function SpellTimers({
  live,
  champions,
  champDetails,
  version
}: {
  live: LiveSnapshot
  champions: Record<number, ChampionInfo>
  champDetails: Record<number, ChampionDetail>
  version: string
}) {
  const [timers, setTimers] = useState<Record<string, Timer>>({})
  const [cosmic, setCosmic] = useState<Record<string, boolean>>({})
  const [lastT, setLastT] = useState(live.gameTime)
  const t = live.gameTime

  useEffect(() => {
    if (t < lastT - 5) {
      setTimers({})
      setCosmic({})
    }
    setLastT(t)
  }, [t, lastT])

  const champOf = (p: LivePlayer) => Object.values(champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
  const enemies = lanePairs(live)
    .map((x) => ({ lane: x.lane, p: x.enemy }))
    .filter((x): x is { lane: string; p: LivePlayer } => !!x.p)

  const toggle = (key: string, cd: number) =>
    setTimers((cur) => {
      const next = { ...cur }
      if (next[key] && next[key].end > t) delete next[key]
      else if (cd > 0) next[key] = { end: t + cd, total: cd }
      return next
    })

  const Btn = ({ k, cd, icon, label }: { k: string; cd: number; icon?: string; label: string }) => {
    const tm = timers[k]
    const left = tm ? tm.end - t : 0
    const running = tm && left > 0
    const cls = `spell ${running ? (left <= 10 ? 'soon' : 'down') : cd === 0 ? 'na' : ''}`
    return (
      <button className={cls} onClick={() => toggle(k, cd)} title={cd ? `${label} · ${cd}s cooldown` : `${label} · unavailable`}>
        {icon ? <img src={icon} alt="" /> : <span className="spell-text">{label}</span>}
        <span className="spell-time mono">{running ? fmtTime(left) : cd ? `${cd}` : '-'}</span>
      </button>
    )
  }

  return (
    <div className="spells">
      {enemies.map(({ lane, p }) => {
        const c = champOf(p)
        const ci = cosmic[p.riotId] ?? false
        const s1 = p.spell1
        const s2 = p.spell2
        const ult = ultCooldown(p, c ? champDetails[c.id] : undefined)
        const k1 = SPELL_KEY[baseSpell(s1)]
        const k2 = SPELL_KEY[baseSpell(s2)]
        return (
          <div key={p.riotId} className="spell-row">
            <span className="lane">{LANE_SHORT[lane]}</span>
            {c ? <img className="spell-champ" src={champIcon(c.key)} alt="" title={`${c.name} · ${p.riotId}`} /> : <span className="noimg" />}
            <Btn k={`${p.riotId}:1`} cd={spellCooldown(s1, p, ci)} icon={k1 && version ? `${DD}/${version}/img/spell/${k1}.png` : undefined} label={baseSpell(s1)} />
            <Btn k={`${p.riotId}:2`} cd={spellCooldown(s2, p, ci)} icon={k2 && version ? `${DD}/${version}/img/spell/${k2}.png` : undefined} label={baseSpell(s2)} />
            <Btn k={`${p.riotId}:R`} cd={ult} label="R" />
            <button
              className={`ci ${ci ? 'on' : ''}`}
              onClick={() => setCosmic((cur) => ({ ...cur, [p.riotId]: !ci }))}
              title="Cosmic Insight (-summoner cooldown). Not visible for enemies. Toggle if you know they run it."
            >
              CI
            </button>
          </div>
        )
      })}
    </div>
  )
}
