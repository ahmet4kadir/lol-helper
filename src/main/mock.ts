import type { ChampSelectState, LiveSnapshot, MatchDetail, MatchParticipant, MatchTeam, PlayerProfile } from '@shared/types'

/** Deterministic fake profile so the players panels can be developed offline. */
export function mockProfile(riotId: string, puuid = `mock-${riotId}`): PlayerProfile {
  let h = 0
  for (const ch of riotId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND']
  const champs = [103, 266, 64, 222, 412, 86, 121, 134, 51, 117, 157, 238]
  const recent = Array.from({ length: 20 }, (_, i) => {
    const r = (h + i * 7919) >>> 0
    return {
      gameId: 1000 + i,
      queueId: 420,
      createdAt: Date.now() - i * 3600_000,
      durationSec: 1500 + (r % 900),
      championId: champs[(r >> 3) % champs.length],
      win: r % 3 !== 0,
      kills: r % 12,
      deaths: (r >> 2) % 9,
      assists: (r >> 4) % 15,
      cs: 120 + (r % 120),
      lane: 'MIDDLE',
      role: 'SOLO',
      visionScore: 10 + (r % 40),
      wardsPlaced: 5 + (r % 15),
      wardsKilled: r % 7,
      controlWards: (r >> 6) % 4,
      firstBloodKill: r % 5 === 0,
      firstBloodAssist: r % 7 === 0,
      damageToChamps: 8000 + (r % 25000),
      damageToObjectives: 3000 + (r % 20000),
      goldEarned: 8000 + (r % 8000)
    }
  })
  const byChamp = new Map<number, { championId: number; games: number; wins: number; kills: number; deaths: number; assists: number }>()
  for (const g of recent) {
    const c = byChamp.get(g.championId) ?? { championId: g.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 }
    c.games++
    if (g.win) c.wins++
    c.kills += g.kills
    c.deaths += g.deaths
    c.assists += g.assists
    byChamp.set(g.championId, c)
  }
  const wins = 60 + (h % 80)
  return {
    puuid,
    summonerId: h % 100000,
    riotId,
    level: 30 + (h % 400),
    iconId: 1,
    solo: { queue: 'RANKED_SOLO_5x5', tier: tiers[h % tiers.length], division: ['I', 'II', 'III', 'IV'][(h >> 3) % 4], lp: h % 100, wins, losses: 50 + ((h >> 5) % 80) },
    flex: null,
    recent,
    champions: [...byChamp.values()].sort((a, b) => b.games - a.games),
    fetchedAt: Date.now()
  }
}

/**
 * Fake data so the UI can be developed without launching League.
 * Enable with `npm run dev:mock`.
 */

export const mockChampSelect: ChampSelectState = {
  localCellId: 2,
  timerPhase: 'BAN_PICK',
  timeLeftMs: 27000,
  myTeam: [
    { cellId: 0, championId: 266, pickIntentId: 0, assignedPosition: 'top', summonerId: 1, puuid: 'a', spell1Id: 4, spell2Id: 12, isSelf: false, nameVisible: true },
    { cellId: 1, championId: 64, pickIntentId: 0, assignedPosition: 'jungle', summonerId: 2, puuid: 'b', spell1Id: 4, spell2Id: 11, isSelf: false, nameVisible: true },
    { cellId: 2, championId: 103, pickIntentId: 0, assignedPosition: 'middle', summonerId: 3, puuid: 'c', spell1Id: 4, spell2Id: 14, isSelf: true, nameVisible: true },
    { cellId: 3, championId: 0, pickIntentId: 222, assignedPosition: 'bottom', summonerId: 4, puuid: 'd', spell1Id: 4, spell2Id: 7, isSelf: false, nameVisible: true },
    { cellId: 4, championId: 412, pickIntentId: 0, assignedPosition: 'utility', summonerId: 5, puuid: 'e', spell1Id: 4, spell2Id: 14, isSelf: false, nameVisible: true }
  ],
  theirTeam: [
    { cellId: 5, championId: 86, pickIntentId: 0, assignedPosition: '', summonerId: 0, puuid: '', spell1Id: 0, spell2Id: 0, isSelf: false, nameVisible: false },
    { cellId: 6, championId: 121, pickIntentId: 0, assignedPosition: '', summonerId: 0, puuid: '', spell1Id: 0, spell2Id: 0, isSelf: false, nameVisible: false },
    { cellId: 7, championId: 134, pickIntentId: 0, assignedPosition: '', summonerId: 0, puuid: '', spell1Id: 0, spell2Id: 0, isSelf: false, nameVisible: false },
    { cellId: 8, championId: 0, pickIntentId: 0, assignedPosition: '', summonerId: 0, puuid: '', spell1Id: 0, spell2Id: 0, isSelf: false, nameVisible: false },
    { cellId: 9, championId: 0, pickIntentId: 0, assignedPosition: '', summonerId: 0, puuid: '', spell1Id: 0, spell2Id: 0, isSelf: false, nameVisible: false }
  ],
  myBans: [157],
  theirBans: [55],
  myAction: { id: 7, type: 'pick', championId: 103, completed: false, isInProgress: true }
}

export function mockLive(t: number): LiveSnapshot {
  const mk = (riotId: string, championName: string, team: 'ORDER' | 'CHAOS', position: string, level: number) => ({
    riotId,
    championName,
    rawChampionName: `game_character_displayname_${championName}`,
    team,
    position,
    level,
    isDead: riotId === 'Enemy2#TR1' ? t % 60 < 35 : riotId === 'Ally3#TR1' ? t % 90 < 20 : false,
    respawnTimer: riotId === 'Enemy2#TR1' ? Math.max(0, 35 - (t % 60)) : riotId === 'Ally3#TR1' ? Math.max(0, 20 - (t % 90)) : 0,
    items: [{ itemID: 1001, displayName: 'Boots', price: 300, count: 1, slot: 0 }],
    kills: Math.floor(t / 300),
    deaths: 0,
    assists: 1,
    creepScore: Math.floor(t / 7),
    wardScore: 2,
    spell1: 'Flash',
    spell2: 'Ignite'
  })
  return {
    gameTime: t,
    gameMode: 'CLASSIC',
    mapNumber: 11,
    activePlayer: { riotId: 'You#TR1', level: 1 + Math.floor(t / 120), currentGold: 500 + t * 2 },
    players: [
      mk('You#TR1', 'Ahri', 'ORDER', 'MIDDLE', 1 + Math.floor(t / 120)),
      mk('Ally1#TR1', 'Aatrox', 'ORDER', 'TOP', 1 + Math.floor(t / 130)),
      mk('Ally2#TR1', 'LeeSin', 'ORDER', 'JUNGLE', 1 + Math.floor(t / 125)),
      mk('Ally3#TR1', 'Jinx', 'ORDER', 'BOTTOM', 1 + Math.floor(t / 140)),
      mk('Ally4#TR1', 'Thresh', 'ORDER', 'UTILITY', 1 + Math.floor(t / 160)),
      mk('Enemy1#TR1', 'Garen', 'CHAOS', 'TOP', 1 + Math.floor(t / 125)),
      mk('Enemy2#TR1', 'Khazix', 'CHAOS', 'JUNGLE', 1 + Math.floor(t / 130)),
      mk('Enemy3#TR1', 'Syndra', 'CHAOS', 'MIDDLE', 1 + Math.floor(t / 120)),
      mk('Enemy4#TR1', 'Caitlyn', 'CHAOS', 'BOTTOM', 1 + Math.floor(t / 140)),
      mk('Enemy5#TR1', 'Lulu', 'CHAOS', 'UTILITY', 1 + Math.floor(t / 165))
    ],
    events: [
      { id: 0, name: 'GameStart', time: 0 },
      ...(t > 400 ? [{ id: 1, name: 'DragonKill', time: 400 }] : []),
      ...(t > 540 ? [{ id: 2, name: 'HordeKill', time: 540 }] : [])
    ]
  }
}

/** Fake full match for the lookup panel in mock mode. */
export function mockMatch(gameId: number): MatchDetail {
  const names = ['You#TR1', 'Ally1#TR1', 'Ally2#TR1', 'Ally3#TR1', 'Ally4#TR1', 'Enemy1#TR1', 'Enemy2#TR1', 'Enemy3#TR1', 'Enemy4#TR1', 'Enemy5#TR1']
  const champs = [103, 266, 64, 222, 412, 86, 121, 134, 51, 117]
  const lanes = ['MIDDLE', 'TOP', 'JUNGLE', 'BOTTOM', 'BOTTOM', 'TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'BOTTOM']
  const roles = ['SOLO', 'SOLO', 'NONE', 'DUO_CARRY', 'DUO_SUPPORT', 'SOLO', 'NONE', 'SOLO', 'DUO_CARRY', 'DUO_SUPPORT']
  const participants: MatchParticipant[] = names.map((riotId, i) => {
    const r = (gameId * 31 + i * 97) >>> 0
    return {
      riotId,
      puuid: `mock-${riotId}`,
      championId: champs[i],
      teamId: i < 5 ? 100 : 200,
      lane: lanes[i],
      role: roles[i],
      level: 13 + (r % 6),
      kills: r % 12,
      deaths: (r >> 2) % 9,
      assists: (r >> 4) % 15,
      cs: 90 + (r % 180),
      gold: 9000 + (r % 8000),
      damageToChamps: 8000 + (r % 30000),
      damageTaken: 10000 + (r % 25000),
      visionScore: 8 + (r % 40),
      wardsPlaced: 4 + (r % 15),
      controlWards: r % 4,
      items: [3020, 3089, 4645, 3157, 3135, 1058].map((x, k) => (k < 3 + (r % 3) ? x : 0)),
      trinket: 3364,
      spell1Id: 4,
      spell2Id: i === 2 || i === 6 ? 11 : 14,
      keystone: 8112,
      largestMultiKill: 1 + (r % 3)
    }
  })
  const team = (teamId: number): MatchTeam => {
    const members = participants.filter((p) => p.teamId === teamId)
    return {
      teamId,
      win: teamId === 100 ? gameId % 3 !== 0 : gameId % 3 === 0,
      kills: members.reduce((a, p) => a + p.kills, 0),
      gold: members.reduce((a, p) => a + p.gold, 0),
      towers: (gameId + teamId) % 11,
      dragons: (gameId + teamId) % 5,
      barons: (gameId + teamId) % 2,
      grubs: (gameId + teamId) % 7,
      heralds: (gameId + teamId) % 2,
      bans: teamId === 100 ? [157, 238, 55, 777, 11] : [105, 7, 84, 141, 245],
      participants: members
    }
  }
  return { gameId, queueId: 420, gameMode: 'CLASSIC', createdAt: Date.now() - gameId * 3600_000, durationSec: 1500 + (gameId % 900), patch: '16.20', teams: [team(100), team(200)] }
}
