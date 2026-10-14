import type { LcuConnector } from './connector'

interface Conversation {
  id: string
  type: string // "championSelect" | "club" | "chat" ...
}

/** Posts a message into the current champ select lobby chat. */
export async function sendChampSelectMessage(lcu: LcuConnector, body: string): Promise<void> {
  const convs = await lcu.request<Conversation[]>('GET', '/lol-chat/v1/conversations')
  const cs = convs.find((c) => c.type === 'championSelect')
  if (!cs) throw new Error('No champ select conversation')
  await lcu.request('POST', `/lol-chat/v1/conversations/${encodeURIComponent(cs.id)}/messages`, {
    body,
    type: 'chat'
  })
}
