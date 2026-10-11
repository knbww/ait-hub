import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import type { ConversationRow, MessageReportRow, MessageRow } from '../lib/db'

/** The caller's chats with the last message and the unread count. */
export function useInbox(enabled = true) {
  return useQuery<ConversationRow[]>({
    queryKey: ['chats'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.rpc('my_conversations')
      if (error) throw error
      return (data ?? []) as ConversationRow[]
    },
  })
}

/** The latest messages of a chat, oldest first. */
export function useMessages(conversationId: string | undefined) {
  return useQuery<MessageRow[]>({
    queryKey: ['messages', conversationId ?? null],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      if (!supabase || !conversationId) return []
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, author_id, body, created_at, author:profiles!messages_author_id_fkey(full_name, avatar_path, role)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      return (data as unknown as MessageRow[]).reverse()
    },
  })
}

/** Live updates for every chat the member takes part in: the database sends only what its
 * rules let this member read. Mounted once, in the layout. */
export function useChatLive(profileId: string | undefined) {
  useEffect(() => {
    const client = supabase
    if (!client || !profileId) return
    const channel = client
      .channel(`chats-${profileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as { conversation_id?: string }
        void queryClient.invalidateQueries({ queryKey: ['chats'] })
        if (row.conversation_id) void queryClient.invalidateQueries({ queryKey: ['messages', row.conversation_id] })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['chats'] })
        void queryClient.invalidateQueries({ queryKey: ['messages'] })
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [profileId])
}

/** Reports for the director and the curator, open ones first. */
export function useReports(enabled: boolean) {
  return useQuery<MessageReportRow[]>({
    queryKey: ['reports'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('message_reports')
        .select('id, message_id, conversation_id, excerpt, reason, status, created_at, resolved_at, ' +
          'reporter:profiles!message_reports_reporter_id_fkey(full_name), author:profiles!message_reports_author_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      const rows = data as unknown as MessageReportRow[]
      return [...rows.filter((r) => r.status === 'open'), ...rows.filter((r) => r.status !== 'open')]
    },
  })
}
