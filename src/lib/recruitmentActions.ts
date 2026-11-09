// Changes to team applications. Every one goes through a database function that checks access and
// the second factor and writes the audit log (supabase/migrations/20261109120000_team_recruitment.sql).

import { notConfigured, refresh, rpc } from './mutate'
import type { Result } from './mutate'
import { supabase } from './supabase'
import type { TeamApplicationRow } from './db'

const touched = (id: string) => [['applications'], ['application', id]]

export const setApplicationStatus = (id: string, status: string) =>
  rpc('set_application_status', { p_application: id, p_status: status }, touched(id))

export const assignApplication = (id: string, assignee: string | null) =>
  rpc('assign_application', { p_application: id, p_assignee: assignee }, touched(id))

export const setApplicationScore = (id: string, score: number | null) =>
  rpc('set_application_score', { p_application: id, p_score: score }, touched(id))

export const addApplicationNote = (id: string, body: string) =>
  rpc<string>('add_application_note', { p_application: id, p_body: body }, [['application-notes', id]])

export async function deleteApplicationNote(noteId: string, applicationId: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('team_application_notes').delete().eq('id', noteId)
  if (error) return { data: null, error }
  await refresh([['application-notes', applicationId]])
  return { data: null, error: null }
}

export const deleteApplication = (id: string) => rpc('delete_application', { p_application: id }, [['applications']])

export const grantRecruitmentAccess = (profileId: string, canExport: boolean) =>
  rpc('grant_recruitment_access', { p_profile: profileId, p_can_export: canExport }, [['recruitment-team']])

export const revokeRecruitmentAccess = (profileId: string) =>
  rpc('revoke_recruitment_access', { p_profile: profileId }, [['recruitment-team'], ['applications']])

export const setRecruitmentWindow = (opens: string, closes: string) =>
  rpc('set_recruitment_window', { p_opens: opens, p_closes: closes }, [['recruitment-window']])

/** Every application, for a CSV. Needs the right to export; the database logs it. */
export const exportApplications = () => rpc<TeamApplicationRow[]>('export_applications', {})
