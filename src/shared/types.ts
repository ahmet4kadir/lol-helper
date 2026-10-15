// Types shared between main, preload and renderer.

export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'InProgress'
  | 'Reconnect'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'
  | string

export type DamageType = 'AD' | 'AP' | 'Mixed' | 'Unknown'

/** Static champion info from Data Dragon. */
export interface ChampionInfo {
  id: number
  key: string // e.g. "Ahri"
  name: string // e.g. "Ahri"
  tags: string[] // Fighter, Mage, ...
  attack: number // 0-10 Riot "info" ratings
  magic: number
  damageType: DamageType
  roles: string[] // lanes in priority order
  compTags: string[] // tank, engage, peel, poke, ...
}

export interface ChampSelectPlayer {
  cellId: number
  championId: number // 0 = not picked yet
  pickIntentId: number
  assignedPosition: string // "top" | "jungle" | "middle" | "bottom" | "utility" | ""
  summonerId: number
  puuid: string
  spell1Id: number
  spell2Id: number
  isSelf: boolean
  nameVisible: boolean
}

export interface ChampSelectAction {
  id: number
  type: 'ban' | 'pick' | string
  championId: number
  completed: boolean
  isInProgress: boolean
}

export interface ChampSelectState {
  localCellId: number
  timerPhase: string // PLANNING | BAN_PICK | FINALIZATION | GAME_STARTING
  timeLeftMs: number
  myTeam: ChampSelectPlayer[]
  theirTeam: ChampSelectPlayer[]
  myBans: number[]
  theirBans: number[]
  /** The local player's action that is currently in progress (ban or pick), if any. */
  myAction: ChampSelectAction | null
}

export interface ItemInfo {
  id: number
  name: string
  gold: number
  /** Flat move speed from item stats (boots). */
  msFlat: number
  /** Percent move speed from item stats, 0.07 = 7%. Passives written only in text are not included. */
  msPct: number
}

export interface RuneInfo {
  id: number
  name: string
  icon: string // path under https://ddragon.leagueoflegends.com/cdn/img/
  style: number // 8000 Precision, 8100 Domination, 8200 Sorcery, 8300 Inspiration, 8400 Resolve
}

export interface BuildEntry {
  id: number
  winRate: number
  games: number
}

export interface ChampBuild {
  championId: number
  lane: string
  patch: string
  fetchedAt: number
  source: string
  start: { ids: number[]; winRate: number; games: number }
  core: { ids: number[]; winRate: number; games: number }
  item4: BuildEntry[]
  item5: BuildEntry[]
  item6: BuildEntry[]
  runes: { primary: number[]; secondary: number[]; shards: number[]; winRate: number; games: number }
  summoners: { ids: number[]; winRate: number; games: number }
  skillPriority: string // e.g. "QWE"
  skillOrder: string // e.g. "QWEQQRQWQWRWWEE"
}

export interface LiveItem {
  itemID: number
  displayName: string
  price: number
  count: number
  slot: number
}

export interface LivePlayer {
  riotId: string // "Name#TAG"
  championName: string
  rawChampionName: string
  team: 'ORDER' | 'CHAOS'
  position: string // TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY | ""
  level: number
  isDead: boolean
  respawnTimer: number
  items: LiveItem[]
  kills: number
  deaths: number
  assists: number
  creepScore: number
  wardScore: number
  spell1: string // localized display name
  spell2: string
  /** Language-independent key from rawDisplayName, e.g. SummonerFlash, SummonerDot (Ignite). */
  spell1Key: string
  spell2Key: string
}

export interface LiveEvent {
  id: number
  name: string
  time: number
  [k: string]: unknown
}

export interface LiveSnapshot {
  gameTime: number
  gameMode: string
  mapNumber: number
  activePlayer: {
    riotId: string
    level: number
    currentGold: number
  } | null
  players: LivePlayer[]
  events: LiveEvent[]
}

/** Per-champion, per-lane meta stats from the stats provider. */
export interface ChampLaneStats {
  championId: number
  lane: string
  winRate: number // 0..100
  pickRate: number // 0..100
  banRate: number // 0..100
  games: number
  /** Share of this champion's games played in this lane, 0..100. */
  lanePct?: number
  /** The lane this champion is most played in, per the provider. */
  defaultLane?: string
}

export interface MetaStats {
  patch: string
  fetchedAt: number
  source: string
  /** lane -> stats sorted by win rate desc */
  byLane: Record<string, ChampLaneStats[]>
}

// ---------- player profiles (from the client, no API key) ----------

export interface RankEntry {
  queue: string // RANKED_SOLO_5x5 | RANKED_FLEX_SR
  tier: string // IRON..CHALLENGER, '' if unranked
  division: string // I..IV
  lp: number
  wins: number
  losses: number
}

export interface RecentGame {
  gameId: number
  queueId: number
  createdAt: number
  durationSec: number
  championId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  lane: string
  role: string // DUO_SUPPORT | DUO_CARRY | SOLO | NONE
  visionScore: number
  wardsPlaced: number
  wardsKilled: number
  controlWards: number
  firstBloodKill: boolean
  firstBloodAssist: boolean
  damageToChamps: number
  damageToObjectives: number
  goldEarned: number
}

export interface MatchParticipant {
  riotId: string
  puuid: string
  championId: number
  teamId: number // 100 blue, 200 red
  lane: string
  role: string
  level: number
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damageToChamps: number
  damageTaken: number
  visionScore: number
  wardsPlaced: number
  controlWards: number
  items: number[] // item0..item5 (0 = empty)
  trinket: number
  spell1Id: number
  spell2Id: number
  keystone: number
  largestMultiKill: number
}

export interface MatchTeam {
  teamId: number
  win: boolean
  kills: number
  gold: number
  towers: number
  dragons: number
  barons: number
  grubs: number
  heralds: number
  bans: number[]
  participants: MatchParticipant[]
}

export interface MatchDetail {
  gameId: number
  queueId: number
  gameMode: string
  createdAt: number
  durationSec: number
  patch: string
  teams: MatchTeam[]
}

/** A short judgement about a player derived from recent games. */
export interface PlayerTrait {
  label: string
  tone: 'good' | 'bad' | 'neutral'
  detail: string
}

export interface ChampionRecord {
  championId: number
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
  masteryPoints?: number
  masteryLevel?: number
}

export interface PlayerProfile {
  puuid: string
  summonerId: number
  riotId: string // "Name#TAG"
  level: number
  iconId: number
  solo: RankEntry | null
  flex: RankEntry | null
  recent: RecentGame[]
  /** Per-champion aggregate of recent games, plus mastery where known. */
  champions: ChampionRecord[]
  fetchedAt: number
  error?: string
}

/** Static per-champion detail needed by overlay timers. */
export interface ChampionDetail {
  id: number
  moveSpeed: number
  /** Ultimate cooldown by rank (seconds), empty when the champion has no normal ultimate. */
  ultCooldown: number[]
  ultName: string
}

export interface LobbyMember {
  puuid: string
  riotId: string
  isLeader: boolean
  pos1: string
  pos2: string
}

export interface UpdateStatus {
  state: 'disabled' | 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'error'
  version: string
  next?: string
  percent?: number
  error?: string
}

export interface AppState {
  lcuConnected: boolean
  phase: GameflowPhase
  champSelect: ChampSelectState | null
  liveConnected: boolean
  live: LiveSnapshot | null
  champions: Record<number, ChampionInfo>
  items: Record<number, ItemInfo>
  runes: Record<number, RuneInfo>
  ddragonVersion: string
  meta: MetaStats | null
  metaError: string | null
  /** Build for the local player's current pick / pick intent. */
  build: ChampBuild | null
  buildError: string | null
  /** Player profiles by puuid: allies in champ select, all ten once in game, and lookups. */
  profiles: Record<string, PlayerProfile>
  /** Live-game riotId -> puuid, filled once the game is visible. */
  livePuuids: Record<string, string>
  champDetails: Record<number, ChampionDetail>
  update: UpdateStatus
  /** The logged-in player's puuid, once the client is connected. */
  mePuuid: string
  /** Current lobby members (including you) while in a lobby, else empty. */
  lobby: LobbyMember[]
  overlayEditMode: boolean
  /** True while the scoreboard key (Tab) is held in game. */
  tabHeld: boolean
  keyHookAvailable: boolean
  keyHookError: string
  mock: boolean
}

export const initialAppState: AppState = {
  lcuConnected: false,
  phase: 'None',
  champSelect: null,
  liveConnected: false,
  live: null,
  champions: {},
  items: {},
  runes: {},
  ddragonVersion: '',
  meta: null,
  metaError: null,
  build: null,
  buildError: null,
  profiles: {},
  livePuuids: {},
  champDetails: {},
  update: { state: 'disabled', version: '' },
  mePuuid: '',
  lobby: [],
  overlayEditMode: true,
  tabHeld: false,
  keyHookAvailable: false,
  keyHookError: '',
  mock: false
}

/** IPC channel names. */
export const IPC = {
  state: 'state', // main -> renderer, full AppState
  getState: 'get-state', // renderer -> main (invoke)
  setOverlayEditMode: 'overlay:set-edit-mode',
  /** renderer -> main: true = clicks pass through to the game (hovering empty space). */
  setOverlayIgnoreMouse: 'overlay:ignore-mouse',
  openControl: 'control:open',
  /** renderer -> main: post a message to the champ select chat. */
  sendChampSelectChat: 'champselect:chat',
  /** renderer -> main (invoke): hover or lock a champion for the current ban/pick action. */
  champSelectAction: 'champselect:action',
  refreshMeta: 'meta:refresh',
  /** renderer -> main (invoke): look a player up by "Name#TAG"; result lands in state.profiles. */
  lookupPlayer: 'player:lookup',
  /** renderer -> main (invoke): full details of one game from the client's match history. */
  getMatch: 'match:get',
  /** main -> overlay: a chat line typed in game, e.g. "mid flash". */
  chatCommand: 'chat:command',
  /** main -> overlay: screen position of a left click made while Tab was held. */
  tabClick: 'tab:click',
  installUpdate: 'update:install',
  checkUpdate: 'update:check'
} as const
