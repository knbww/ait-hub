import { supabase } from './supabase'
import { queryClient } from './queryClient'

/** Enrol the member in a course (own-row RLS on enrollments). */
export async function enrollCourse(profileId: string, courseId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' }
  const { error } = await supabase
    .from('enrollments')
    .insert({ profile_id: profileId, course_id: courseId, progress: 0 })
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['courses'] })
  return { error: null }
}
