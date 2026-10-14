import type { ChampSelectPlayer, ChampSelectState } from '@shared/types'

/** Raw shape of /lol-champ-select/v1/session (only the fields we use). */
export interface RawChampSelectSession {
  localPlayerCellId: number
  timer?: { phase?: string; adjustedTimeLeftInPhase?: number }
  myTeam?: RawCell[]
  theirTeam?: RawCell[]
  bans?: { myTeamBans?: number[]; theirTeamBans?: number[] }
  actions?: RawAction[][]
}

export interface RawAction {
  id: number
  actorCellId: number
  championId: number
  completed: boolean
  isInProgress: boolean
  type: string
}

interface RawCell {
  cellId: number
  championId: number
  championPickIntent?: number
  assignedPosition?: string
  summonerId?: number
  puuid?: string
  spell1Id?: number
  spell2Id?: number
  nameVisibilityType?: string
}

function cell(c: RawCell, localCellId: number): ChampSelectPlayer {
  return {
    cellId: c.cellId,
    championId: c.championId ?? 0,
    pickIntentId: c.championPickIntent ?? 0,
    assignedPosition: c.assignedPosition ?? '',
    summonerId: c.summonerId ?? 0,
    puuid: c.puuid ?? '',
    spell1Id: c.spell1Id ?? 0,
    spell2Id: c.spell2Id ?? 0,
    isSelf: c.cellId === localCellId,
    nameVisible: c.nameVisibilityType !== 'HIDDEN'
  }
}

export function parseChampSelect(raw: RawChampSelectSession): ChampSelectState {
  const local = raw.localPlayerCellId
  return {
    localCellId: local,
    timerPhase: raw.timer?.phase ?? '',
    timeLeftMs: raw.timer?.adjustedTimeLeftInPhase ?? 0,
    myTeam: (raw.myTeam ?? []).map((c) => cell(c, local)),
    theirTeam: (raw.theirTeam ?? []).map((c) => cell(c, local)),
    myBans: raw.bans?.myTeamBans ?? [],
    theirBans: raw.bans?.theirTeamBans ?? [],
    myAction: myAction(raw)
  }
}

function myAction(raw: RawChampSelectSession): ChampSelectState['myAction'] {
  const a = (raw.actions ?? []).flat().find((x) => x.actorCellId === raw.localPlayerCellId && x.isInProgress && !x.completed)
  if (!a) return null
  return { id: a.id, type: a.type, championId: a.championId, completed: a.completed, isInProgress: a.isInProgress }
}
