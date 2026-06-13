// Pure AIP helpers: action labels, the Council award taxonomy, and the
// display-rank ladder. No I/O — the natural unit-test targets.

/** Source key → human-readable AIP action label. */
export const AIP_ACTIONS: Record<string, string> = {
  attendance: 'Посещение встречи',
  assignment: 'Зачёт задания',
  help: 'Помощь участнику',
  project_stage: 'Проектный этап',
  prize: 'Призовое место',
  referral: 'Приглашённый участник',
  team_bonus: 'Командный бонус',
  manual: 'Ручное начисление',
  seed: 'Стартовый баланс',
  github: 'GitHub-активность',
}

export function aipActionLabel(source: string): string {
  return AIP_ACTIONS[source] ?? source
}

/** Default points per action (spec §8); prefills the Council award form.
 * 0 = variable amount (admin types it). */
export const AIP_DEFAULT_POINTS: Record<string, number> = {
  manual: 0,
  help: 15,
  project_stage: 30,
  prize: 50,
  referral: 40,
  team_bonus: 0,
}

/** Action types offered in the Council "award AIP" form (attendance/assignment
 * are awarded automatically by the Academy flow, not by hand). */
export const AIP_AWARD_SOURCES = [
  'manual',
  'help',
  'project_stage',
  'prize',
  'referral',
  'team_bonus',
] as const

/** Display-rank ladder derived from total AIP. Keys map to `rank.*` i18n keys.
 * Privilege roles (member/mentor/admin) are separate and Council-appointed. */
export const AIP_RANKS = [
  { key: 'member', min: 0 },
  { key: 'specialist', min: 500 },
  { key: 'founder', min: 1500 },
] as const

export interface RankInfo {
  /** i18n key under `rank.*`. */
  current: string
  next: string | null
  /** AIP remaining to the next rank, or null at the top / for Council. */
  toNext: number | null
  floor: number
  ceil: number | null
}

/** A member's display rank from their AIP total and privilege role.
 * Admins are shown as «Совет / Council» regardless of AIP. */
export function aipRank(totalAip: number, role?: string): RankInfo {
  if (role === 'admin') {
    return { current: 'council', next: null, toNext: null, floor: 0, ceil: null }
  }
  let idx = 0
  for (let i = 0; i < AIP_RANKS.length; i++) {
    if (totalAip >= AIP_RANKS[i].min) idx = i
  }
  const current = AIP_RANKS[idx]
  const next = AIP_RANKS[idx + 1] ?? null
  return {
    current: current.key,
    next: next?.key ?? null,
    toNext: next ? Math.max(0, next.min - totalAip) : null,
    floor: current.min,
    ceil: next?.min ?? null,
  }
}
