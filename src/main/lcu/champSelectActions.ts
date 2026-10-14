import type { LcuConnector } from './connector'
import type { RawChampSelectSession } from './champSelect'

/**
 * Hover (declare) or lock in a champion for the local player's current
 * ban/pick action. Uses the client's own champ select endpoints, exactly
 * what clicking in the client does.
 */
export async function champSelectAction(
  lcu: LcuConnector,
  championId: number,
  lock: boolean
): Promise<{ type: string }> {
  const session = await lcu.request<RawChampSelectSession>('GET', '/lol-champ-select/v1/session')
  const local = session.localPlayerCellId
  const mine = (session.actions ?? [])
    .flat()
    .find((a) => a.actorCellId === local && a.isInProgress && !a.completed)
  if (!mine) throw new Error('No ban/pick action in progress for you right now')
  await lcu.request('PATCH', `/lol-champ-select/v1/session/actions/${mine.id}`, {
    championId,
    ...(lock ? { completed: true } : {})
  })
  return { type: mine.type }
}
