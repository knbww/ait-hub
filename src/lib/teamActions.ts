import { supabase } from './supabase'
import { queryClient } from './queryClient'

const NOT_CONFIGURED = 'Supabase не настроен.'

export async function createTeam(name: string, goal: string, roles: string[]) {
  if (!supabase) return { error: NOT_CONFIGURED }
  const { error } = await supabase.rpc('create_team', {
    p_name: name,
    p_goal: goal,
    p_roles: roles,
  })
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['teams'] })
  return { error: null }
}

export async function requestJoin(teamId: string, role: string, note: string) {
  if (!supabase) return { result: null, error: NOT_CONFIGURED }
  const { data, error } = await supabase.rpc('request_join_team', {
    p_team: teamId,
    p_role: role,
    p_note: note,
  })
  if (error) return { result: null, error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['team-requests'] })
  return { result: data as string, error: null }
}

export async function respondRequest(requestId: string, accept: boolean) {
  if (!supabase) return { result: null, error: NOT_CONFIGURED }
  const { data, error } = await supabase.rpc('respond_join_request', {
    p_request: requestId,
    p_accept: accept,
  })
  if (error) return { result: null, error: error.message }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['teams'] }),
    queryClient.invalidateQueries({ queryKey: ['team-requests'] }),
  ])
  return { result: data as string, error: null }
}
