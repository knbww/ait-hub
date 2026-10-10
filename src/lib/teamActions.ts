import { rpc } from './mutate'
import { supabase } from './supabase'
import { notify } from './push'

const TEAM_KEYS = [['teams'], ['team-requests']]

export const createTeam = (name: string, goal: string) =>
  rpc<string>('create_team', { p_name: name.trim(), p_goal: goal.trim() || null }, TEAM_KEYS)

export const updateTeam = (teamId: string, name: string, goal: string) =>
  rpc('update_team', { p_team: teamId, p_name: name.trim(), p_goal: goal.trim() || null }, TEAM_KEYS)

export async function requestJoinTeam(teamId: string, note: string) {
  const res = await rpc('request_join_team', { p_team: teamId, p_note: note.trim() || null }, TEAM_KEYS)
  if (!res.error && supabase) {
    // The captain hears about it; only the request just made is pending for this team.
    const { data } = await supabase.from('team_requests').select('id').eq('team_id', teamId).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (data) notify({ action: 'team_request', request_id: (data as { id: string }).id })
  }
  return res
}

export const respondJoinRequest = (requestId: string, accept: boolean) =>
  rpc('respond_join_request', { p_request: requestId, p_accept: accept }, TEAM_KEYS)

/** Leave (own id) or remove a member (captain / staff). */
export const removeTeamMember = (teamId: string, profileId: string) =>
  rpc('remove_team_member', { p_team: teamId, p_profile: profileId }, TEAM_KEYS)

export const archiveTeam = (teamId: string) => rpc('archive_team', { p_team: teamId }, TEAM_KEYS)
