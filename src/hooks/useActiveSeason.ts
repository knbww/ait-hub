import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Season, SeasonWeek } from '../types'
import type { SeasonRow, SeasonWeekRow } from '../lib/db-rows'

function toWeek(r: SeasonWeekRow): SeasonWeek {
  const links: { label: string; url: string }[] = []
  if (r.course_url) links.push({ label: 'Course', url: r.course_url })
  if (r.colab_url) links.push({ label: 'Colab', url: r.colab_url })
  if (r.kaggle_url) links.push({ label: 'Kaggle', url: r.kaggle_url })
  if (r.video_url) links.push({ label: 'Video', url: r.video_url })
  return {
    id: r.id,
    weekNumber: r.week_number,
    topic: r.topic,
    description: r.description,
    links,
    assignmentBrief: r.assignment_brief,
    dueDate: r.due_date,
  }
}

/** The current active season + its ordered weekly program (public read; mock
 * preview when Supabase isn't configured). Returns null when no season is live. */
export function useActiveSeason() {
  return useQuery<Season | null>({
    queryKey: ['season', 'active'],
    queryFn: async () => {
      if (!supabase) return null
      const { data: seasons, error } = await supabase
        .from('seasons')
        .select('id, title, description, start_date, week_count, status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<SeasonRow[]>()
      if (error) throw error
      const s = seasons[0]
      if (!s) return null

      const { data: weeks, error: weeksError } = await supabase
        .from('season_weeks')
        .select(
          'id, season_id, week_number, topic, description, course_url, colab_url, kaggle_url, video_url, assignment_brief, due_date',
        )
        .eq('season_id', s.id)
        .order('week_number', { ascending: true })
        .returns<SeasonWeekRow[]>()
      if (weeksError) throw weeksError

      return {
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status,
        weekCount: s.week_count,
        weeks: weeks.map(toWeek),
      }
    },
  })
}
