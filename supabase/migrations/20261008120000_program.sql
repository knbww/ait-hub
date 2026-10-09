-- Launch prep (October 2026), step 3: the year programme.
--
-- One 36-week programme per track (titles from the track calendars); materials live in Drive,
-- so a week stores a link, not content. Dates belong to the cohort: the director builds the
-- schedule from week 1 and shifts it when the calendar moves. A week has two meetings
-- (lesson + practicum). Attendance is optional for members and earns nothing — the lead marks
-- it; what is required is the work, submitted as a link and reviewed by the track lead.

create table public.program_weeks (
  id            uuid primary key default gen_random_uuid(),
  track_id      text not null references public.tracks (id),
  week_number   int  not null check (week_number between 1 and 36),
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  materials_url text check (materials_url is null or materials_url ~* '^https://'),
  assignment    text check (assignment is null or char_length(assignment) <= 2000),
  unique (track_id, week_number)
);

insert into public.program_weeks (track_id, week_number, title)
select 'ai', n, t from unnest(array[
  'Python, Colab и данные', 'Python для проектов', 'Состояния и обход графа', 'Degrees', 'Degrees',
  'Эвристики и игры', 'Tic-Tac-Toe', 'Tic-Tac-Toe', 'Логика', 'Knights',
  'Агенты на основе знаний', 'Minesweeper', 'Вероятность', 'Байесовские сети', 'Heredity',
  'Марковские модели', 'PageRank', 'Оптимизация', 'Задачи с ограничениями', 'Crossword',
  'Crossword', 'Обучение с учителем', 'Shopping', 'Обучение с подкреплением', 'Nim',
  'Нейронные сети', 'Компьютерное зрение', 'Traffic', 'Traffic', 'Язык: синтаксис',
  'Parser', 'Язык: смысл', 'Внимание и трансформеры', 'Attention', 'Резерв', 'Резерв'
]) with ordinality as w(t, n);

insert into public.program_weeks (track_id, week_number, title)
select 'algo', n, t from unnest(array[
  'Среда и целые типы', 'Сложность и полный перебор', 'Префиксные суммы',
  'Сортировка и компараторы', 'Бинарный поиск и поиск по ответу', 'Два указателя и окно',
  'set и map', 'Жадные алгоритмы', 'Итоги блока', 'Стек и монотонный стек',
  'Рекурсия и перебор с возвратом', 'Графы, DFS, BFS', 'Кратчайший путь без весов',
  'Компоненты и топологическая сортировка', 'ДП: от рекурсии к таблице',
  'ДП: рюкзак и подпоследовательности', 'Стресс-тестирование', 'Итоги блока', 'СНМ', 'Дейкстра',
  'Дерево отрезков: запросы', 'Дерево отрезков: обновление на отрезке', 'ДП по подотрезкам',
  'ДП на битовых масках', 'Комбинаторика и модульная арифметика', 'Теория чисел', 'Итоги блока',
  'Хеширование', 'Префикс-функция и Z-функция', 'Деревья и LCA', 'Геометрия',
  'Битовые трюки и константа', 'Стратегия контеста', 'Разбор олимпиадных задач',
  'Итоговый контест', 'Разбор и план на лето'
]) with ordinality as w(t, n);

insert into public.program_weeks (track_id, week_number, title)
select 'startup', n, t from unnest(array[
  'Проблема вместо идеи', 'Поиск возможностей', 'Интервью', 'Разбор интервью',
  'Ценностное предложение и лендинг', 'Проверка спроса', 'Команда и общий код', 'Путь пользователя',
  'Пользователь и его данные', 'Главная функция', 'MVP', 'Запуск', 'Метрики',
  'Цена и первая оплата', 'Итерация', 'Питч и демо', 'Соответствие продукта рынку', 'Эксперименты',
  'Юнит-экономика', 'Финансовый прогноз', 'Продажи', 'Переговоры и партнёрства',
  'Каналы привлечения', 'Выход на рынок', 'Что ломается при росте', 'Изменения без поломок',
  'Мобильный канал', 'ИИ в продукте', 'Безопасность и данные пользователей', 'Операции и команда',
  'Право', 'Инвестиции', 'Питч-дек и видео', 'Итоговый питч', 'Резерв', 'Резерв'
]) with ordinality as w(t, n);

-- Week dates per cohort (Monday of each week). Rows exist only for scheduled weeks: this
-- year started in October, so fewer than 36 weeks fit.
create table public.cohort_weeks (
  cohort_id   uuid not null references public.cohorts (id) on delete cascade,
  week_number int  not null check (week_number between 1 and 36),
  starts_on   date not null,
  primary key (cohort_id, week_number)
);

create table public.submissions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  week_id      uuid not null references public.program_weeks (id) on delete cascade,
  link         text not null check (link ~* '^https?://' and char_length(link) <= 500),
  comment      text check (comment is null or char_length(comment) <= 1000),
  status       text not null default 'submitted' check (status in ('submitted', 'accepted', 'needs_work')),
  feedback     text check (feedback is null or char_length(feedback) <= 2000),
  reviewer_id  uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  unique (profile_id, week_id)
);
create index on public.submissions (week_id);

create table public.attendance (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  week_id    uuid not null references public.program_weeks (id) on delete cascade,
  kind       text not null check (kind in ('lesson', 'practicum')),
  marked_by  uuid references public.profiles (id) on delete set null,
  marked_at  timestamptz not null default now(),
  primary key (profile_id, week_id, kind)
);
create index on public.attendance (week_id);

-- ── Access ───────────────────────────────────────────────────────────────────
alter table public.program_weeks enable row level security;
alter table public.cohort_weeks  enable row level security;
alter table public.submissions   enable row level security;
alter table public.attendance    enable row level security;

revoke all on public.program_weeks, public.cohort_weeks, public.submissions, public.attendance
  from anon, authenticated;
grant select on public.program_weeks, public.cohort_weeks, public.submissions, public.attendance
  to authenticated;
grant update (title, materials_url, assignment) on public.program_weeks to authenticated;

create policy program_weeks_select on public.program_weeks for select to authenticated
  using (public.is_active_member());
create policy program_weeks_update on public.program_weeks for update to authenticated
  using (public.is_oversight() or (public.my_role() = 'track_lead' and track_id = public.my_track_id()))
  with check (public.is_oversight() or (public.my_role() = 'track_lead' and track_id = public.my_track_id()));

create policy cohort_weeks_select on public.cohort_weeks for select to authenticated
  using (public.is_active_member());

-- Works and attendance: the member, their track lead, director / curator.
create policy submissions_select on public.submissions for select to authenticated
  using (profile_id = public.current_profile_id() or public.can_manage(profile_id));
create policy attendance_select on public.attendance for select to authenticated
  using (profile_id = public.current_profile_id() or public.can_manage(profile_id));

-- ── Schedule (director / curator) ───────────────────────────────────────────
create or replace function public.set_schedule(p_start date, p_last_week int default 36)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_oversight() then
    raise exception 'forbidden';
  end if;
  if p_start is null or p_last_week not between 1 and 36 then
    raise exception 'invalid_schedule';
  end if;

  delete from public.cohort_weeks where cohort_id = public.default_cohort_id();
  insert into public.cohort_weeks (cohort_id, week_number, starts_on)
  select public.default_cohort_id(), n, p_start + (n - 1) * 7
  from generate_series(1, p_last_week) as n;

  perform public.log_action('schedule_set', null,
    jsonb_build_object('start', p_start, 'last_week', p_last_week));
end;
$$;

-- Holidays / moved weeks: shift this week and everything after it.
create or replace function public.shift_schedule(p_from_week int, p_days int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_oversight() then
    raise exception 'forbidden';
  end if;
  if p_days is null or p_days = 0 or abs(p_days) > 120 then
    raise exception 'invalid_shift';
  end if;

  update public.cohort_weeks
    set starts_on = starts_on + p_days
    where cohort_id = public.default_cohort_id() and week_number >= p_from_week;

  perform public.log_action('schedule_shifted', null,
    jsonb_build_object('from_week', p_from_week, 'days', p_days));
end;
$$;

-- ── Works ────────────────────────────────────────────────────────────────────
create or replace function public.submit_work(p_week uuid, p_link text, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    public.profiles%rowtype;
  v_track text;
  v_link  text := btrim(coalesce(p_link, ''));
begin
  select * into v_me from public.profiles where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not_authenticated';
  end if;
  select track_id into v_track from public.program_weeks where id = p_week;
  if not found then
    raise exception 'not_found';
  end if;
  if v_me.track_id is distinct from v_track then
    raise exception 'wrong_track';
  end if;
  if v_link !~* '^https?://' then
    raise exception 'invalid_link';
  end if;

  insert into public.submissions (profile_id, week_id, link, comment)
  values (v_me.id, p_week, v_link, nullif(btrim(coalesce(p_comment, '')), ''))
  on conflict (profile_id, week_id) do update
    set link = excluded.link,
        comment = excluded.comment,
        status = 'submitted',
        feedback = null,
        reviewer_id = null,
        reviewed_at = null,
        submitted_at = now();
end;
$$;

create or replace function public.review_work(p_submission uuid, p_status text, p_feedback text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid;
begin
  select profile_id into v_target from public.submissions where id = p_submission;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.can_manage(v_target) or v_target = public.current_profile_id() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('accepted', 'needs_work') then
    raise exception 'invalid_status';
  end if;

  update public.submissions
    set status = p_status,
        feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
        reviewer_id = public.current_profile_id(),
        reviewed_at = now()
    where id = p_submission;
end;
$$;

-- ── Attendance (marked by staff, never by members) ──────────────────────────
create or replace function public.set_attendance(p_profile uuid, p_week uuid, p_kind text, p_present boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage(p_profile) then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('lesson', 'practicum') then
    raise exception 'invalid_kind';
  end if;
  if not exists (
    select 1 from public.program_weeks w join public.profiles p on p.id = p_profile
    where w.id = p_week and w.track_id = p.track_id
  ) then
    raise exception 'wrong_track';
  end if;

  if p_present then
    insert into public.attendance (profile_id, week_id, kind, marked_by)
    values (p_profile, p_week, p_kind, public.current_profile_id())
    on conflict do nothing;
  else
    delete from public.attendance where profile_id = p_profile and week_id = p_week and kind = p_kind;
  end if;
end;
$$;
