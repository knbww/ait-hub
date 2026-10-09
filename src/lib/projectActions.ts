import { supabase } from './supabase'
import { notConfigured, refresh, rpc } from './mutate'
import type { Result } from './mutate'
import type { ProjectStatus } from './db'

export interface ProjectInput {
  title: string
  problem: string
  target_user: string
  scope: string
  roles: string
  starts_on: string
  ends_on: string
  verification: string
  demo: string
  links: string
  team_id: string | null
}

const PROJECT_KEYS = [['projects'], ['project']]
const blank = (v: string) => (v.trim() ? v.trim() : null)

export const createProject = (input: ProjectInput) =>
  rpc<string>(
    'create_project',
    {
      p_title: input.title.trim(),
      p_problem: input.problem.trim(),
      p_target_user: input.target_user.trim(),
      p_scope: blank(input.scope),
      p_roles: blank(input.roles),
      p_starts_on: input.starts_on || null,
      p_ends_on: input.ends_on || null,
      p_verification: blank(input.verification),
      p_demo: blank(input.demo),
      p_links: blank(input.links),
      p_team: input.team_id,
    },
    PROJECT_KEYS,
  )

export async function updateProject(id: string, input: ProjectInput & { status: ProjectStatus }): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase
    .from('projects')
    .update({
      title: input.title.trim(),
      problem: input.problem.trim(),
      target_user: input.target_user.trim(),
      scope: blank(input.scope),
      roles: blank(input.roles),
      starts_on: input.starts_on || null,
      ends_on: input.ends_on || null,
      verification: blank(input.verification),
      demo: blank(input.demo),
      links: blank(input.links),
      team_id: input.team_id,
      status: input.status,
    })
    .eq('id', id)
  if (error) return { data: null, error }
  await refresh(PROJECT_KEYS)
  return { data: null, error: null }
}

export async function updateContribution(projectId: string, profileId: string, role: string, contribution: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase
    .from('project_members')
    .update({ role: blank(role), contribution: blank(contribution) })
    .eq('project_id', projectId)
    .eq('profile_id', profileId)
  if (error) return { data: null, error }
  await refresh(PROJECT_KEYS)
  return { data: null, error: null }
}

export const addProjectMember = (projectId: string, profileId: string) =>
  rpc('add_project_member', { p_project: projectId, p_profile: profileId }, PROJECT_KEYS)

export const removeProjectMember = (projectId: string, profileId: string) =>
  rpc('remove_project_member', { p_project: projectId, p_profile: profileId }, PROJECT_KEYS)

export const confirmContribution = (projectId: string, profileId: string) =>
  rpc('confirm_contribution', { p_project: projectId, p_profile: profileId }, PROJECT_KEYS)
