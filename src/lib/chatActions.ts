import { supabase } from './supabase'
import { notConfigured, refresh, rpc } from './mutate'
import { notify } from './push'
import type { Result } from './mutate'

export const openTeamChat = (teamId: string) => rpc<string>('open_team_chat', { p_team: teamId }, [['chats']])
export const openProjectChat = (projectId: string) => rpc<string>('open_project_chat', { p_project: projectId }, [['chats']])
/** Without a member: the caller's own conversation with club management. */
export const openLeadChat = (memberId?: string) =>
  rpc<string>('open_lead_chat', memberId ? { p_member: memberId } : {}, [['chats']])

export async function sendMessage(conversationId: string, body: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { data, error } = await supabase.from('messages').insert({ conversation_id: conversationId, body }).select('id').single()
  if (error) return { data: null, error }
  notify({ action: 'message', message_id: (data as { id: string }).id })
  await refresh([['messages', conversationId], ['chats']])
  return { data: null, error: null }
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('messages').delete().eq('id', messageId)
  if (error) return { data: null, error }
  await refresh([['messages', conversationId], ['chats']])
  return { data: null, error: null }
}

export async function markChatRead(conversationId: string) {
  if (!supabase) return
  const { error } = await supabase.rpc('mark_chat_read', { p_conversation: conversationId })
  if (!error) await refresh([['chats']])
}

export async function reportMessage(messageId: string, reason: string): Promise<Result> {
  const res = await rpc<string | null>('report_message', { p_message: messageId, p_reason: reason.trim() || null })
  if (!res.error && res.data) notify({ action: 'report', report_id: res.data })
  return { data: null, error: res.error }
}

export const resolveReport = (reportId: string, remove: boolean) =>
  rpc('resolve_report', { p_report: reportId, p_remove: remove }, [['reports'], ['audit-log']])
