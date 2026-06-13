// Pure challenge helpers shared across the challenge pages.

export const CHALLENGE_STATUS: Record<string, string> = {
  draft: 'Черновик',
  open: 'Открыт',
  judging: 'Оценивание',
  closed: 'Завершён',
}

/** Default prize AIP per place (within the spec's 50–100). */
export const PRIZE_BY_PLACE: Record<number, number> = { 1: 100, 2: 75, 3: 50 }
