// Row shapes as PostgREST returns them (snake_case). Hand-written to match
// supabase/migrations/2026100812*; keep them in sync when a migration changes a table.

export type Role = 'member' | 'track_lead' | 'director' | 'curator'
export type TrackId = 'ai' | 'algo' | 'startup'
export type MemberStatus = 'active' | 'inactive'

export interface ProfileRow {
  id: string
  user_id: string | null
  full_name: string
  role: Role
  grade: number | null
  track_id: TrackId | null
  cohort_id: string | null
  avatar_path: string | null
  github_username: string | null
  codeforces_handle: string | null
  status: MemberStatus
  course_completed_at: string | null
  created_at: string
}

export interface MemberPrivateRow {
  profile_id: string
  email: string | null
  telegram: string | null
  /** May the club photograph the member? null = not answered. */
  photo_consent: boolean | null
}

export interface TrackRow {
  id: TrackId
  title: string
  short_title: string
  drive_url: string | null
  sort: number
}

export interface ProgramWeekRow {
  id: string
  track_id: TrackId
  week_number: number
  title: string
  materials_url: string | null
  assignment: string | null
  /** Certificate milestone finished by this week's work (e.g. a CS50 project). */
  milestone: string | null
}

export interface CohortWeekRow {
  week_number: number
  starts_on: string
}

export type SubmissionStatus = 'submitted' | 'accepted' | 'needs_work'

/** A file handed in with a work: `path` in the private `works` bucket, the original name. */
export interface WorkFile {
  path: string
  name: string
  size: number
}

export interface SubmissionRow {
  id: string
  profile_id: string
  week_id: string
  /** A link, files, or both. */
  link: string | null
  files: WorkFile[]
  comment: string | null
  status: SubmissionStatus
  feedback: string | null
  submitted_at: string
  reviewed_at: string | null
}

export type MeetingKind = 'lesson' | 'practicum'

export interface AttendanceRow {
  profile_id: string
  week_id: string
  kind: MeetingKind
}

export type PointsCategory =
  | 'required_work'
  | 'extra_work'
  | 'project_stage'
  | 'event'
  | 'team_help'
  | 'org_contribution'
  | 'correction'

export interface PointsEntryRow {
  id: string
  profile_id: string
  amount: number
  category: PointsCategory
  note: string
  created_at: string
  member?: { full_name: string } | null
  awarder?: { full_name: string } | null
}

export interface LeaderboardRow {
  profile_id: string
  full_name: string
  avatar_path: string | null
  track_id: TrackId | null
  grade: number | null
  total: number
}

export type EventType =
  | 'contest'
  | 'tournament'
  | 'pitch_review'
  | 'simulation'
  | 'workshop'
  | 'hackathon'
  | 'demo_day'
  | 'talkx'
  | 'club_evening'

export type EventStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed'

export interface EventRow {
  id: string
  type: EventType
  title: string
  track_id: TrackId | null
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  responsible_id: string | null
  is_rated: boolean
  rules: string | null
  rules_url: string | null
  rules_published_at: string | null
  status: EventStatus
  responsible?: { full_name: string } | null
}

export interface RatingResultRow {
  id: string
  event_id: string
  profile_id: string | null
  team_id: string | null
  place: number | null
  score: number | null
  rating_delta: number
  note: string | null
  profile?: { full_name: string } | null
  team?: { name: string } | null
}

export interface TrackRatingRow {
  profile_id: string
  full_name: string
  avatar_path: string | null
  grade: number | null
  rating: number
  events: number
  best_place: number | null
  last_event_at: string | null
}

export interface TeamRatingRow {
  team_id: string
  name: string
  status: string
  rating: number
  events: number
  best_place: number | null
}

export interface TeamRow {
  id: string
  name: string
  track_id: TrackId
  goal: string | null
  captain_id: string | null
  status: 'active' | 'archived'
  created_at: string
  team_members?: { profile_id: string; joined_at: string; profile: { full_name: string; avatar_path: string | null } | null }[]
}

export interface TeamRequestRow {
  id: string
  team_id: string
  profile_id: string
  note: string | null
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  profile?: { full_name: string; grade: number | null } | null
}

export type ProjectStatus = 'idea' | 'active' | 'done' | 'archived'

export interface ProjectRow {
  id: string
  title: string
  problem: string
  target_user: string
  scope: string | null
  roles: string | null
  starts_on: string | null
  ends_on: string | null
  verification: string | null
  demo: string | null
  links: string | null
  status: ProjectStatus
  team_id: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
  team?: { name: string } | null
  project_members?: ProjectMemberRow[]
}

export interface ProjectMemberRow {
  project_id: string
  profile_id: string
  role: string | null
  contribution: string | null
  confirmed_at: string | null
  profile?: { full_name: string; track_id: TrackId | null; avatar_path: string | null } | null
  confirmer?: { full_name: string } | null
}

export interface JoinCodeRow {
  code: string
  track_id: TrackId
  active: boolean
  created_at: string
}

export interface NewsRow {
  id: string
  title: string
  body: string
  link_url: string | null
  /** null = the whole club. */
  track_id: TrackId | null
  pinned: boolean
  author_id: string | null
  published_at: string
  updated_at: string
  /** Files in the private `news` bucket, `<post id>/<name>`; at most six. */
  photos: string[]
  allow_comments: boolean
  author?: { full_name: string } | null
  likes?: { profile_id: string; profile: { full_name: string } | null }[]
  /** Only ids — enough to count; the comments themselves load when a post is opened. */
  comments?: { id: string }[]
}

export interface NewsCommentRow {
  id: string
  news_id: string
  author_id: string
  body: string
  created_at: string
  author?: { full_name: string; avatar_path: string | null } | null
}

export interface AuditRow {
  id: number
  action: string
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
  actor?: { full_name: string } | null
}
