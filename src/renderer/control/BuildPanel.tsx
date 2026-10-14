import type { ChampBuild, ChampionInfo, ItemInfo, RuneInfo } from '@shared/types'
import { LANE_LABEL } from '@shared/analysis'

const DD = 'https://ddragon.leagueoflegends.com/cdn'
const SUMMONER_NAME: Record<number, string> = {
  1: 'Cleanse',
  3: 'Exhaust',
  4: 'Flash',
  6: 'Ghost',
  7: 'Heal',
  11: 'Smite',
  12: 'Teleport',
  14: 'Ignite',
  21: 'Barrier'
}
const SUMMONER_KEY: Record<number, string> = {
  1: 'SummonerBoost',
  3: 'SummonerExhaust',
  4: 'SummonerFlash',
  6: 'SummonerHaste',
  7: 'SummonerHeal',
  11: 'SummonerSmite',
  12: 'SummonerTeleport',
  14: 'SummonerDot',
  21: 'SummonerBarrier'
}
const STYLE_NAME: Record<number, string> = { 8000: 'Precision', 8100: 'Domination', 8200: 'Sorcery', 8300: 'Inspiration', 8400: 'Resolve' }

function Item({ id, items, version, label }: { id: number; items: Record<number, ItemInfo>; version: string; label?: string }) {
  const it = items[id]
  return (
    <div className="item" title={it ? `${it.name} (${it.gold}g)` : String(id)}>
      <img src={`${DD}/${version}/img/item/${id}.png`} alt="" />
      {label && <span className="item-label">{label}</span>}
    </div>
  )
}

function Rune({ id, runes, big }: { id: number; runes: Record<number, RuneInfo>; big?: boolean }) {
  const r = runes[id]
  return (
    <div className={`rune ${big ? 'keystone' : ''}`} title={r?.name ?? String(id)}>
      {r ? <img src={`${DD}/img/${r.icon}`} alt="" /> : <span className="noimg" />}
    </div>
  )
}

function Stat({ wr, n }: { wr: number; n: number }) {
  return (
    <span className="muted stat">
      <b style={{ color: wr >= 52 ? 'var(--ok)' : 'inherit' }}>{wr.toFixed(1)}%</b> · {n.toLocaleString()} games
    </span>
  )
}

export function BuildPanel({
  build,
  error,
  champ,
  items,
  runes,
  version
}: {
  build: ChampBuild | null
  error: string | null
  champ?: ChampionInfo
  items: Record<number, ItemInfo>
  runes: Record<number, RuneInfo>
  version: string
}) {
  if (!champ) {
    return (
      <section className="team">
        <h2>Your build</h2>
        <div className="muted">Hover or pick a champion to see its build.</div>
      </section>
    )
  }
  if (!build || build.championId !== champ.id) {
    return (
      <section className="team">
        <h2>Your build — {champ.name}</h2>
        <div className="muted">{error ? `Build unavailable: ${error}` : 'Loading build…'}</div>
      </section>
    )
  }
  const primaryStyle = runes[build.runes.primary[0]]?.style ?? 0
  const secondaryStyle = runes[build.runes.secondary[0]]?.style ?? 0
  return (
    <section className="team build">
      <h2>
        Your build — {champ.name} <span className="muted">· {LANE_LABEL[build.lane] ?? build.lane} · patch {build.patch} · Emerald+</span>
      </h2>

      <div className="build-row">
        <div className="build-label">Start</div>
        <div className="items">
          {build.start.ids.map((id, i) => (
            <Item key={i} id={id} items={items} version={version} />
          ))}
        </div>
        <Stat wr={build.start.winRate} n={build.start.games} />
      </div>

      <div className="build-row">
        <div className="build-label">Core</div>
        <div className="items">
          {build.core.ids.map((id, i) => (
            <Item key={i} id={id} items={items} version={version} label={String(i + 1)} />
          ))}
        </div>
        <Stat wr={build.core.winRate} n={build.core.games} />
      </div>

      {(['item4', 'item5', 'item6'] as const).map((k, idx) => (
        <div className="build-row" key={k}>
          <div className="build-label">Item {idx + 4}</div>
          <div className="items">
            {build[k].slice(0, 4).map((e) => (
              <div className="item-opt" key={e.id}>
                <Item id={e.id} items={items} version={version} />
                <span className="muted mono">{e.winRate.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="build-row">
        <div className="build-label">Runes</div>
        <div className="runes">
          <div className="rune-page">
            <span className="muted" style={{ fontSize: 11 }}>{STYLE_NAME[primaryStyle] ?? ''}</span>
            {build.runes.primary.map((id, i) => (
              <Rune key={id} id={id} runes={runes} big={i === 0} />
            ))}
          </div>
          <div className="rune-page">
            <span className="muted" style={{ fontSize: 11 }}>{STYLE_NAME[secondaryStyle] ?? ''}</span>
            {build.runes.secondary.map((id) => (
              <Rune key={id} id={id} runes={runes} />
            ))}
          </div>
          <div className="rune-page shards">
            <span className="muted" style={{ fontSize: 11 }}>Shards</span>
            {build.runes.shards.map((id, i) => (
              <Rune key={i} id={id} runes={runes} />
            ))}
          </div>
        </div>
        <Stat wr={build.runes.winRate} n={build.runes.games} />
      </div>

      <div className="build-row">
        <div className="build-label">Spells</div>
        <div className="items">
          {build.summoners.ids.map((id) => (
            <div className="item" key={id} title={SUMMONER_NAME[id] ?? String(id)}>
              {SUMMONER_KEY[id] ? <img src={`${DD}/${version}/img/spell/${SUMMONER_KEY[id]}.png`} alt="" /> : <span className="noimg" />}
            </div>
          ))}
        </div>
        <Stat wr={build.summoners.winRate} n={build.summoners.games} />
      </div>

      <div className="build-row">
        <div className="build-label">Skills</div>
        <div className="skills">
          <span className="skill-pri mono">{build.skillPriority.split('').join(' > ')}</span>
          <span className="skill-order mono muted">{build.skillOrder.slice(0, 15)}</span>
        </div>
      </div>
    </section>
  )
}
