import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface CatalogCourse {
  id: string
  title: string
  level: string | null
  syllabusUrl: string | null
}

interface CatalogRow {
  id: string
  title: string
  level: string | null
  syllabus_url: string | null
}

/** The full course catalogue, for the enrol picker. */
export function useAllCourses() {
  return useQuery<CatalogCourse[]>({
    queryKey: ['all-courses'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, level, syllabus_url')
        .order('title', { ascending: true })
        .returns<CatalogRow[]>()
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        title: r.title,
        level: r.level,
        syllabusUrl: r.syllabus_url,
      }))
    },
  })
}
