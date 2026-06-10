// Hand-written row shapes for the columns the UI reads. Phase-1 convenience —
// replace with `npm run db:types` generated types once the project is linked.

export type UserRole = 'member' | 'mentor' | 'admin'

export interface ProfileRow {
  id: string
  full_name: string
  role: UserRole
  avatar_url: string | null
}

export interface LeaderboardRow {
  profile_id: string
  full_name: string
  avatar_url: string
  xp: number
}

export interface ResearchPaperRow {
  id: string
  author_name: string | null
  title: string
  tags: string[]
  citations: number
}

export interface DeadlineRow {
  id: string
  title: string
  due_date: string
  scope: string
}

export interface SkillRow {
  id: string
  skill: string
  level: number
  category: string | null
}

export interface ProofOfWorkRow {
  id: string
  period: string
  task: string
  status: 'completed' | 'pending'
}

export interface CourseEnrollmentRow {
  progress: number
  courses: {
    title: string
    instructor: string | null
    duration: string | null
    level: string | null
  } | null
}

export interface ProjectRow {
  id: string
  title: string
  progress: number
}

export interface MentorRow {
  id: string
  full_name: string
  university: string | null
  grad_year: string | null
  title: string | null
}

export interface ResourceRow {
  id: string
  title: string
  description: string | null
  category: string | null
  url: string | null
  icon: string | null
}

export interface ProfileLinksRow {
  github_url: string | null
  leetcode_url: string | null
  linkedin_url: string | null
}

export interface ApplicationRow {
  id: string
  full_name: string | null
  email: string
  status: string
  created_at: string
}

export interface BookingRow {
  id: string
  mentor_name: string | null
  requester_name: string
  requester_email: string
  status: string
  created_at: string
}

export interface GithubStatsRow {
  open_prs: number
  last_commit_at: string | null
  commit_series: number[]
}

export interface ActivityRow {
  day: string
  count: number
}
