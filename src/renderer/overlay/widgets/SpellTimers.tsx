import { useEffect, useState } from 'react'
import type { ChampionDetail, ChampionInfo, LivePlayer, LiveSnapshot } from '@shared/types'
import { IONIAN_BOOTS_ID, SUMMONER_CD, SUMMONER_HASTE, SUMMONER_LABEL } from '@shared/gameConstants'
import { champIcon } from '../../hooks/useAppState'
import { fmtTime, lanePairs, LANE_SHORT } from '../lanes'

const DD = 'https://ddragon.leagueoflegends.com/cdn'

export function spellCooldown(key: string, p: LivePlayer, cosmic: boolean): number {
  let base = SUMMONER_CD[key] ?? 0
  if (key === 'SummonerTeleport' && p.level >= 11) base = 240 // Unleashed Teleport
  let haste = 0
  if (p.items.some((i) => i.itemID === IONIAN_BOOTS_ID)) haste += SUMMONER_HASTE.ionianBoots
  if (cosmic) haste += SUMMONER_HASTE.cosmicInsight
  return Math.round((base * 100) / (100 + haste))
}

export function ultCooldown(p: LivePlayer, d?: ChampionDetail): number {
  if (!d || d.ultCooldown.length === 0) return 0
  const rank = p.level >= 16 ? 3 : p.level >= 11 ? 2 : p.level >= 6 ? 1 : 0
  if (rank === 0) return 0
  return d.ultCooldown[Math.min(rank, d.ultCooldown.length) - 1]
}

export interface Timer {
  end: number // game time at which it is back up
  total: number
}

/**
 * Enemy summoner spell and ultimate timers. Click when you see the spell go:
 * the cooldown is computed from the spell, the enemy's boots and level, and
 * the optional Cosmic Insight toggle. Click a running timer to clear it.
 * Timers live in a shared store so the minimap widget can show them too.
 */
export function SpellTimers({
  live,
  champions,
  champDetails,
  version,
  timers,
  setTimers
}: {
  live: LiveSnapshot
  champions: Record<number, ChampionInfo>
  champDetails: Record<number, ChampionDetail>
  version: string
  timers: Record<string, Timer>
  setTimers: (f: (cur: Record<string, Timer>) => Record<string, Timer>) => void
}) {
  const [cosmic, setCosmic] = useState<Record<string, boolean>>({})
  const [lastT, setLastT] = useState(live.gameTime)
  const t = live.gameTime

  useEffect(() => {
    if (t < lastT - 5) {
      setTimers(() => ({}))
      setCosmic({})
    }
    setLastT(t)
  }, [t, lastT, setTimers])

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

  const Btn = ({ k, cd, spellKey, label }: { k: string; cd: number; spellKey?: string; label: string }) => {
    const tm = timers[k]
    const left = tm ? tm.end - t : 0
    const running = tm && left > 0
    const cls = `spell ${running ? (left <= 10 ? 'soon' : 'down') : cd === 0 ? 'na' : ''}`
    const icon = spellKey && version ? `${DD}/${version}/img/spell/${spellKey}.png` : undefined
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
        const ult = ultCooldown(p, c ? champDetails[c.id] : undefined)
        return (
          <div key={p.riotId} className="spell-row">
            <span className="lane">{LANE_SHORT[lane]}</span>
            {c ? <img className="spell-champ" src={champIcon(c.key)} alt="" title={`${c.name} · ${p.riotId}`} /> : <span className="noimg" />}
            <Btn k={`${p.riotId}:1`} cd={spellCooldown(p.spell1Key, p, ci)} spellKey={p.spell1Key || undefined} label={SUMMONER_LABEL[p.spell1Key] ?? p.spell1 ?? '?'} />
            <Btn k={`${p.riotId}:2`} cd={spellCooldown(p.spell2Key, p, ci)} spellKey={p.spell2Key || undefined} label={SUMMONER_LABEL[p.spell2Key] ?? p.spell2 ?? '?'} />
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
