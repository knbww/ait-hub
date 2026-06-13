import { supabase } from './supabase'
import { queryClient } from './queryClient'

const NOT_CONFIGURED = 'Supabase не настроен.'

/** Submit / resubmit a result. Returns the function status (ok | closed | …). */
export async function enterChallenge(challengeId: string, link: string, comment: string) {
  if (!supabase) return { result: null, error: NOT_CONFIGURED }
  const { data, error } = await supabase.rpc('enter_challenge', {
    p_challenge: challengeId,
    p_link: link,
    p_comment: comment,
  })
  if (error) return { result: null, error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] })
  await queryClient.invalidateQueries({ queryKey: ['challenges'] })
  return { result: data as string, error: null }
}

/** Jury grade + optional prize (place 1/2/3 → +100/75/50 by convention). */
export async function judgeEntry(
  challengeId: string,
  entryId: string,
  score: number,
  place: number,
  aip: number,
) {
  if (!supabase) return { error: NOT_CONFIGURED }
  const { error } = await supabase.rpc('judge_entry', {
    p_entry: entryId,
    p_score: score,
    p_place: place,
    p_aip: aip,
  })
  if (error) return { error: error.message }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] }),
    queryClient.invalidateQueries({ queryKey: ['aip-journal'] }),
    queryClient.invalidateQueries({ queryKey: ['aip-leaderboard'] }),
  ])
  return { error: null }
}

export interface NewChallenge {
  title: string
  rules: string
  starterUrl: string
  deadline: string
}

/** Admin: create an open challenge. */
export async function createChallenge(c: NewChallenge) {
  if (!supabase) return { error: NOT_CONFIGURED }
  const { error } = await supabase.from('challenges').insert({
    title: c.title,
    rules: c.rules || null,
    starter_url: c.starterUrl || null,
    deadline: c.deadline || null,
    status: 'open',
  })
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['challenges'] })
  return { error: null }
}

/** Admin: move a challenge through open → judging → closed. */
export async function setChallengeStatus(id: string, status: string) {
  if (!supabase) return { error: NOT_CONFIGURED }
  const { error } = await supabase.from('challenges').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['challenges'] }),
    queryClient.invalidateQueries({ queryKey: ['challenge', id] }),
  ])
  return { error: null }
}
