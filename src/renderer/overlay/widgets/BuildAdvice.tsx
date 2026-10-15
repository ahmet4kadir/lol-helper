import type { AppState, LivePlayer } from '@shared/types'
import { adviseBuild } from '@shared/buildAdvisor'
import { splitTeams } from '../lanes'

const DD = 'https://ddragon.leagueoflegends.com/cdn'

/** "Buy this next": core item, counters to what the enemy has, meta options. */
export function BuildAdvice({ s }: { s: AppState }) {
  const live = s.live!
  const meId = live.activePlayer?.riotId
  const me = live.players.find((p) => p.riotId === meId)
  if (!me) return <div className="muted">-</div>
  const champOf = (p: LivePlayer) => Object.values(s.champions).find((c) => c.key === p.rawChampionName.replace('game_character_displayname_', ''))
  const { enemy } = splitTeams(live)
  const list = adviseBuild({
    me,
    myChamp: champOf(me),
    myGold: live.activePlayer?.currentGold ?? 0,
    enemies: enemy,
    enemyChamps: enemy.map(champOf),
    build: s.build,
    items: s.items
  })
  const v = s.ddragonVersion
  return (
    <div className="badv">
      <div className="badv-mine">
        {me.items
          .filter((i) => i.itemID)
          .map((i, k) => (
            <img key={k} src={`${DD}/${v}/img/item/${i.itemID}.png`} alt="" title={s.items[i.itemID]?.name ?? ''} />
          ))}
        <span className="mono muted">{Math.round(live.activePlayer?.currentGold ?? 0)}g</span>
      </div>
      {list.length === 0 && <div className="muted">{s.build ? 'Build complete' : s.buildError ? 'Build data unavailable' : 'Loading build…'}</div>}
      {list.map((x, i) => (
        <div key={x.itemId} className={`badv-row ${x.kind} ${x.affordable ? 'can' : ''}`}>
          <img src={`${DD}/${v}/img/item/${x.itemId}.png`} alt="" />
          <div className="badv-text">
            <div className="badv-name">
              {i === 0 ? 'Next: ' : ''}
              {x.name} <span className="mono muted">{x.gold}g</span>
              {x.affordable && <span className="badv-can">buy</span>}
            </div>
            <div className="muted">{x.reason}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
