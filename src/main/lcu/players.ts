import type { ChampionRecord, MatchDetail, MatchParticipant, MatchTeam, PlayerProfile, RankEntry, RecentGame } from '@shared/types'
import type { LcuConnector } from './connector'

/**
 * Player profiles through the League client's own endpoints: rank, recent
 * matches and mastery. No Riot API key involved; the client already has
 * access to this data for anyone, which is what Porofessor/Blitz use too.
 */

const TTL = 10 * 60 * 1000
const cache = new Map<string, PlayerProfile>()
const inflight = new Map<string, Promise<PlayerProfile>>()

interface SummonerV2 {
  puuid: string
  summonerId: number
  gameName?: string
  tagLine?: string
  displayName?: string
  summonerLevel: number
  profileIconId: number
}

export function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const m = /^\s*(.+?)\s*#\s*([A-Za-z0-9]{2,6})\s*$/.exec(input)
  return m ? { gameName: m[1], tagLine: m[2] } : null
}

/** Riot ID ("Name#TAG") -> puuid. */
export async function resolvePuuid(lcu: LcuConnector, riotId: string): Promise<string> {
  const id = parseRiotId(riotId)
  if (!id) throw new Error(`Not a Riot ID: ${riotId}`)
  const q = `gameName=${encodeURIComponent(id.gameName)}&tagLine=${encodeURIComponent(id.tagLine)}`
  try {
    const r = await lcu.request<{ puuid: string }>('GET', `/lol-summoner/v1/alias/lookup?${q}`)
    if (r?.puuid) return r.puuid
  } catch {
    /* fall through to the legacy endpoint */
  }
  const legacy = await lcu.request<SummonerV2>('GET', `/lol-summoner/v1/summoners?name=${encodeURIComponent(`${id.gameName}#${id.tagLine}`)}`)
  if (!legacy?.puuid) throw new Error(`Player not found: ${riotId}`)
  return legacy.puuid
}

function rank(q: any, queue: string): RankEntry | null {
  if (!q || !q.tier || q.tier === 'NONE' || q.tier === '') return null
  return {
    queue,
    tier: String(q.tier),
    division: String(q.division ?? ''),
    lp: Number(q.leaguePoints ?? 0),
    wins: Number(q.wins ?? 0),
    losses: Number(q.losses ?? 0)
  }
}

function parseGames(raw: any): RecentGame[] {
  const games: any[] = raw?.games?.games ?? []
  return games
    .map((g) => {
      const p = g.participants?.[0]
      const s = p?.stats ?? {}
      return {
        gameId: Number(g.gameId),
        queueId: Number(g.queueId),
        createdAt: Number(g.gameCreation ?? 0),
        durationSec: Number(g.gameDuration ?? 0),
        championId: Number(p?.championId ?? 0),
        win: !!s.win,
        kills: Number(s.kills ?? 0),
        deaths: Number(s.deaths ?? 0),
        assists: Number(s.assists ?? 0),
        cs: Number(s.totalMinionsKilled ?? 0) + Number(s.neutralMinionsKilled ?? 0),
        lane: String(p?.timeline?.lane ?? ''),
        role: String(p?.timeline?.role ?? ''),
        visionScore: Number(s.visionScore ?? 0),
        wardsPlaced: Number(s.wardsPlaced ?? 0),
        wardsKilled: Number(s.wardsKilled ?? 0),
        controlWards: Number(s.visionWardsBoughtInGame ?? 0),
        firstBloodKill: !!s.firstBloodKill,
        firstBloodAssist: !!s.firstBloodAssist,
        damageToChamps: Number(s.totalDamageDealtToChampions ?? 0),
        damageToObjectives: Number(s.damageDealtToObjectives ?? 0),
        goldEarned: Number(s.goldEarned ?? 0)
      }
    })
    .filter((g) => g.championId > 0)
}

function aggregate(recent: RecentGame[], mastery: any[]): ChampionRecord[] {
  const byChamp = new Map<number, ChampionRecord>()
  for (const g of recent) {
    const r = byChamp.get(g.championId) ?? { championId: g.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 }
    r.games++
    if (g.win) r.wins++
    r.kills += g.kills
    r.deaths += g.deaths
    r.assists += g.assists
    byChamp.set(g.championId, r)
  }
  for (const m of mastery) {
    const id = Number(m.championId)
    const r = byChamp.get(id) ?? { championId: id, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 }
    r.masteryPoints = Number(m.championPoints ?? 0)
    r.masteryLevel = Number(m.championLevel ?? 0)
    byChamp.set(id, r)
  }
  return [...byChamp.values()].sort((a, b) => b.games - a.games || (b.masteryPoints ?? 0) - (a.masteryPoints ?? 0))
}

async function fetchProfile(lcu: LcuConnector, puuid: string): Promise<PlayerProfile> {
  const sum = await lcu.request<SummonerV2>('GET', `/lol-summoner/v2/summoners/puuid/${puuid}`)
  const riotId = sum.gameName ? `${sum.gameName}#${sum.tagLine ?? ''}` : (sum.displayName ?? '')

  const [ranked, history, mastery] = await Promise.all([
    lcu.request<any>('GET', `/lol-ranked/v1/ranked-stats/${puuid}`).catch(() => null),
    lcu.request<any>('GET', `/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=0&endIndex=19`).catch(() => null),
    lcu
      .request<any[]>('GET', `/lol-champion-mastery/v1/${puuid}/champion-mastery/top?limit=5`)
      .catch(() => lcu.request<any[]>('GET', `/lol-collections/v1/inventories/${sum.summonerId}/champion-mastery/top?limit=5`).catch(() => []))
  ])

  const recent = parseGames(history)
  return {
    puuid,
    summonerId: Number(sum.summonerId),
    riotId,
    level: Number(sum.summonerLevel ?? 0),
    iconId: Number(sum.profileIconId ?? 0),
    solo: rank(ranked?.queueMap?.RANKED_SOLO_5x5, 'RANKED_SOLO_5x5'),
    flex: rank(ranked?.queueMap?.RANKED_FLEX_SR, 'RANKED_FLEX_SR'),
    recent,
    champions: aggregate(recent, Array.isArray(mastery) ? mastery : []),
    fetchedAt: Date.now()
  }
}

// ---------- full match detail ----------

const matchCache = new Map<number, MatchDetail>()

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function parseMatch(raw: any): MatchDetail {
  const identities: any[] = raw.participantIdentities ?? []
  const nameOf = (pid: number): { riotId: string; puuid: string } => {
    const id = identities.find((x) => x.participantId === pid)?.player ?? {}
    const riotId = id.gameName ? `${id.gameName}#${id.tagLine ?? ''}` : (id.summonerName ?? '')
    return { riotId, puuid: String(id.puuid ?? '') }
  }
  const participants: MatchParticipant[] = (raw.participants ?? []).map((p: any) => {
    const s = p.stats ?? {}
    const { riotId, puuid } = nameOf(p.participantId)
    return {
      riotId,
      puuid,
      championId: num(p.championId),
      teamId: num(p.teamId),
      lane: String(p.timeline?.lane ?? ''),
      role: String(p.timeline?.role ?? ''),
      level: num(s.champLevel),
      kills: num(s.kills),
      deaths: num(s.deaths),
      assists: num(s.assists),
      cs: num(s.totalMinionsKilled) + num(s.neutralMinionsKilled),
      gold: num(s.goldEarned),
      damageToChamps: num(s.totalDamageDealtToChampions),
      damageTaken: num(s.totalDamageTaken),
      visionScore: num(s.visionScore),
      wardsPlaced: num(s.wardsPlaced),
      controlWards: num(s.visionWardsBoughtInGame),
      items: [s.item0, s.item1, s.item2, s.item3, s.item4, s.item5].map(num),
      trinket: num(s.item6),
      spell1Id: num(p.spell1Id),
      spell2Id: num(p.spell2Id),
      keystone: num(s.perk0),
      largestMultiKill: num(s.largestMultiKill)
    }
  })
  const teams: MatchTeam[] = (raw.teams ?? []).map((t: any) => {
    const members = participants.filter((p) => p.teamId === num(t.teamId))
    return {
      teamId: num(t.teamId),
      win: t.win === 'Win' || t.win === true,
      kills: members.reduce((a, p) => a + p.kills, 0),
      gold: members.reduce((a, p) => a + p.gold, 0),
      towers: num(t.towerKills),
      dragons: num(t.dragonKills),
      barons: num(t.baronKills),
      grubs: num(t.hordeKills),
      heralds: num(t.riftHeraldKills),
      bans: (t.bans ?? []).map((b: any) => num(b.championId)).filter((x: number) => x > 0),
      participants: members
    }
  })
  return {
    gameId: num(raw.gameId),
    queueId: num(raw.queueId),
    gameMode: String(raw.gameMode ?? ''),
    createdAt: num(raw.gameCreation),
    durationSec: num(raw.gameDuration),
    patch: String(raw.gameVersion ?? '').split('.').slice(0, 2).join('.'),
    teams
  }
}

export async function getMatch(lcu: LcuConnector, gameId: number): Promise<MatchDetail> {
  const hit = matchCache.get(gameId)
  if (hit) return hit
  const raw = await lcu.request<any>('GET', `/lol-match-history/v1/games/${gameId}`)
  const m = parseMatch(raw)
  matchCache.set(gameId, m)
  return m
}

export function getProfile(lcu: LcuConnector, puuid: string, force = false): Promise<PlayerProfile> {
  const c = cache.get(puuid)
  if (!force && c && Date.now() - c.fetchedAt < TTL) return Promise.resolve(c)
  const running = inflight.get(puuid)
  if (running) return running
  const p = fetchProfile(lcu, puuid)
    .then((prof) => {
      cache.set(puuid, prof)
      return prof
    })
    .finally(() => inflight.delete(puuid))
  inflight.set(puuid, p)
  return p
}
