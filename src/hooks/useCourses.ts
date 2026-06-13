import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Course } from '../types'
import type { CourseEnrollmentRow } from '../lib/db-rows'

/** A member's enrolled courses with progress + syllabus link (DB-only). */
export function useCourses(profileId?: string) {
  return useQuery<Course[]>({
    queryKey: ['courses', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return []
      const { data, error } = await supabase
        .from('enrollments')
        .select('progress, courses(id, title, instructor, duration, level, syllabus_url)')
        .eq('profile_id', profileId)
        .returns<CourseEnrollmentRow[]>()
      if (error) throw error
      return data
        .filter((r) => r.courses)
        .map((r) => ({
          courseId: r.courses!.id,
          title: r.courses!.title,
          instructor: r.courses!.instructor,
          duration: r.courses!.duration,
          level: r.courses!.level,
          syllabusUrl: r.courses!.syllabus_url,
          progress: r.progress,
        }))
    },
  })
}
