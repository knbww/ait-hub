-- «Мой прогресс» (October 2026): weeks can mark a certificate milestone.
--
-- The AI track's certificate is the twelve CS50 AI projects ("Требования к завершению курса");
-- each is counted when the work of the week that finishes it is accepted. Other tracks count
-- accepted weeks, so they have no milestones unless their lead adds some.

alter table public.program_weeks
  add column milestone text check (milestone is null or char_length(btrim(milestone)) between 1 and 80);

grant update (milestone) on public.program_weeks to authenticated;

update public.program_weeks w
set milestone = m.name
from (values
  (5, 'Degrees'), (8, 'Tic-Tac-Toe'), (10, 'Knights'), (12, 'Minesweeper'),
  (15, 'Heredity'), (17, 'PageRank'), (21, 'Crossword'), (23, 'Shopping'),
  (25, 'Nim'), (29, 'Traffic'), (31, 'Parser'), (34, 'Attention')
) as m(week_number, name)
where w.track_id = 'ai' and w.week_number = m.week_number and w.milestone is null;
