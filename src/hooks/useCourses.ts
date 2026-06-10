import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { courses as mockCourses } from '../data/mock'
import type { Course } from '../types'
import type { CourseEnrollmentRow } from '../lib/db-rows'

/** A member's enrolled courses. Scoped to the signed-in user; mock preview when
 * logged out. */
export function useCourses(profileId?: string) {
  return useQuery<Course[]>({
    queryKey: ['courses', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return mockCourses
      const { data, error } = await supabase
        .from('enrollments')
        .select('progress, courses(title, instructor, duration, level)')
        .eq('profile_id', profileId)
        .returns<CourseEnrollmentRow[]>()
      if (error) throw error
      return data
        .filter((r) => r.courses)
        .map((r) => ({
          title: r.courses!.title,
          instructor: r.courses!.instructor,
          duration: r.courses!.duration,
          level: r.courses!.level,
          progress: r.progress,
        }))
    },
  })
}
