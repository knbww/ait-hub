import { supabase } from './supabase'
import { queryClient } from './queryClient'

const NOT_CONFIGURED = 'Supabase не настроен.'

export async function postHelp(title: string, description: string) {
  if (!supabase) return { error: NOT_CONFIGURED }
  const { error } = await supabase.rpc('post_help', { p_title: title, p_description: description })
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['help'] })
  return { error: null }
}

export async function claimHelp(id: string) {
  if (!supabase) return { result: null, error: NOT_CONFIGURED }
  const { data, error } = await supabase.rpc('claim_help', { p_request: id })
  if (error) return { result: null, error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['help'] })
  return { result: data as string, error: null }
}

export async function confirmHelp(id: string) {
  if (!supabase) return { result: null, error: NOT_CONFIGURED }
  const { data, error } = await supabase.rpc('confirm_help', { p_request: id })
  if (error) return { result: null, error: error.message }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['help'] }),
    queryClient.invalidateQueries({ queryKey: ['aip-journal'] }),
    queryClient.invalidateQueries({ queryKey: ['aip-leaderboard'] }),
  ])
  return { result: data as string, error: null }
}
