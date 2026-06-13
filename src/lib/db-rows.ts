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

export interface AipLeaderboardRow {
  profile_id: string
  full_name: string
  avatar_url: string
  aip: number
}

export interface AipJournalRow {
  id: string
  profile_id: string
  member_name: string
  source: string
  delta: number
  note: string | null
  awarder_name: string | null
  created_at: string
}

export interface ReferralFunnelRow {
  referrer_id: string
  referrer_name: string
  member_id: string
  member_name: string
  joined_at: string
  rewarded: boolean
  reached_week3: boolean
}

export interface ChallengeRow {
  id: string
  title: string
  description: string | null
  rules: string | null
  starter_url: string | null
  starts_at: string | null
  deadline: string | null
  status: string
  created_at: string
}

export interface ChallengeEntryRow {
  id: string
  profile_id: string
  link: string
  comment: string | null
  score: number | null
  place: number | null
  prize_awarded: boolean
  created_at: string
  profiles: { full_name: string } | null
}

export interface TeamRow {
  id: string
  name: string
  goal: string | null
  founder_id: string
  needed_roles: string[]
  status: string
  created_at: string
}

export interface TeamMemberRow {
  team_id: string
  profile_id: string
  role: string
  profiles: { full_name: string } | null
}

export interface TeamRequestRow {
  id: string
  team_id: string
  profile_id: string
  role: string
  note: string | null
  status: string
  profiles: { full_name: string } | null
}

export interface HelpRow {
  id: string
  requester_id: string
  title: string
  description: string | null
  status: 'open' | 'claimed' | 'done'
  helper_id: string | null
  rewarded: boolean
  created_at: string
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
    id: string
    title: string
    instructor: string | null
    duration: string | null
    level: string | null
    syllabus_url: string | null
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

export interface AiScreening {
  score?: number | null
  recommended_role?: string | null
  reasons?: string[] | null
  flags?: string[] | null
}

export interface ApplicationRow {
  id: string
  full_name: string | null
  email: string
  status: string
  ai_score: number | null
  ai_screening: AiScreening | null
  created_at: string
}

export interface AutomationErrorRow {
  id: string
  workflow: string | null
  last_node: string | null
  message: string | null
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

export interface SeasonRow {
  id: string
  title: string
  description: string | null
  start_date: string | null
  week_count: number
  status: string
}

export interface SeasonWeekRow {
  id: string
  season_id: string
  week_number: number
  topic: string
  description: string | null
  course_url: string | null
  colab_url: string | null
  kaggle_url: string | null
  video_url: string | null
  assignment_brief: string | null
  due_date: string | null
}

export interface SubmissionRow {
  id: string
  week_id: string
  profile_id: string
  link: string
  comment: string | null
  status: 'submitted' | 'reviewed'
  passed: boolean | null
  feedback: string | null
  created_at: string
  reviewed_at: string | null
}

/** Host-facing roster slice: one submission's reviewable fields. */
export interface RosterSubmissionRow {
  id: string
  profile_id: string
  link: string
  status: 'submitted' | 'reviewed'
  passed: boolean | null
  feedback: string | null
}
