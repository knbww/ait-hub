-- Demo data: a fictional club in the middle of its year — members of all three tracks, staff,
-- teams, projects, works and their review, attendance, AIT Points, events with published
-- results, news and an audit trail — so every page of the Hub can be seen filled in.
--
-- Applied after the migrations to an EMPTY database only: local development (`supabase db reset`)
-- and the demo copy (`npm run demo`). It refuses to run where members already exist, so it can't
-- reach the club's database. All names are invented.
--
-- Every account signs in with the password `demo-ait-2026` (emails below, @demo.aitclub.org).
-- The demo year is at week 17: the schedule starts 16 weeks before the current Monday.
--
-- One DO block: the Supabase CLI sends a seed file as a single batch, so tables made here have to
-- be created and used inside one statement. It also makes the seed all-or-nothing.

do $seed$
begin
  if exists (select 1 from public.profiles) then
    raise exception 'seed.sql only fills an empty database (local or demo), not one with members';
  end if;

  -- Logins left from an earlier demo (a database reset empties the public schema, not auth).
  delete from auth.users where email like '%@demo.aitclub.org';

  -- ── People ───────────────────────────────────────────────────────────────────
  create temporary table demo_people (
    key        text primary key,
    uid        uuid not null,
    full_name  text not null,
    email      text not null,
    grade      int,
    track      text,
    role       text not null,
    telegram   text,
    photo      boolean not null,
    github     text,
    codeforces text
  );

  insert into demo_people (key, uid, full_name, email, grade, track, role, telegram, photo, github, codeforces) values
    ('director',   'de000000-0000-4000-8000-000000000001', 'Тимур Ахметов',          'director',     11, null,      'director',   'timur_akh',  true,  'timur-akh', null),
    ('curator',    'de000000-0000-4000-8000-000000000002', 'Елена Викторовна Ким',    'curator',      null, null,    'curator',    null,         false, null, null),
    ('lead_ai',    'de000000-0000-4000-8000-000000000003', 'Арман Жумабаев',          'lead.ai',      11, 'ai',      'track_lead', 'arman_zh',   true,  'arman-zh', null),
    ('lead_algo',  'de000000-0000-4000-8000-000000000004', 'Дана Есенова',            'lead.algo',    12, 'algo',    'track_lead', 'dana_es',    true,  null, 'dana_es'),
    ('lead_start', 'de000000-0000-4000-8000-000000000005', 'Мирас Кенжебеков',        'lead.startup', 11, 'startup', 'track_lead', 'miras_k',    true,  'miras-k', null),
    ('aruzhan',    'de000000-0000-4000-8000-000000000101', 'Аружан Сейткали',         'aruzhan',       9, 'ai',      'member',     'aruzhan_s',  true,  'aruzhan-s', null),
    ('nikita',     'de000000-0000-4000-8000-000000000102', 'Никита Павлов',           'nikita',       10, 'ai',      'member',     null,         true,  'npavlov', null),
    ('aliya',      'de000000-0000-4000-8000-000000000103', 'Алия Муратова',           'aliya',         8, 'ai',      'member',     'aliya_m',    false, null, null),
    ('daniyar',    'de000000-0000-4000-8000-000000000104', 'Данияр Оспанов',          'daniyar',      10, 'ai',      'member',     'daniyar_o',  true,  'daniyar-o', null),
    ('sofia',      'de000000-0000-4000-8000-000000000105', 'София Белова',            'sofia',         9, 'ai',      'member',     null,         true,  null, null),
    ('erlan',      'de000000-0000-4000-8000-000000000106', 'Ерлан Касымов',           'erlan',        11, 'ai',      'member',     'erlan_k',    true,  'erlan-k', null),
    ('madina',     'de000000-0000-4000-8000-000000000107', 'Мадина Ахметжанова',      'madina',        7, 'ai',      'member',     null,         false, null, null),
    ('artem',      'de000000-0000-4000-8000-000000000108', 'Артём Ли',                'artem',        10, 'ai',      'member',     'artem_li',   true,  'artem-li', null),
    ('tamerlan',   'de000000-0000-4000-8000-000000000201', 'Тамерлан Абенов',         'tamerlan',     10, 'algo',    'member',     'tamerlan_a', true,  null, 'tamerlan_a'),
    ('polina',     'de000000-0000-4000-8000-000000000202', 'Полина Захарова',         'polina',        9, 'algo',    'member',     null,         true,  null, 'polina_z'),
    ('nursultan',  'de000000-0000-4000-8000-000000000203', 'Нурсултан Исаев',         'nursultan',    11, 'algo',    'member',     'nurs_i',     true,  null, 'nursultan_i'),
    ('kamila',     'de000000-0000-4000-8000-000000000204', 'Камила Турсунова',        'kamila',        8, 'algo',    'member',     null,         false, null, 'kamila_t'),
    ('ivan',       'de000000-0000-4000-8000-000000000205', 'Иван Морозов',            'ivan',         10, 'algo',    'member',     'ivan_m',     true,  null, 'ivan_m'),
    ('aisulu',     'de000000-0000-4000-8000-000000000206', 'Айсулу Бекова',           'aisulu',        9, 'algo',    'member',     null,         true,  null, 'aisulu_b'),
    ('rustam',     'de000000-0000-4000-8000-000000000207', 'Рустам Галиев',           'rustam',       12, 'algo',    'member',     'rustam_g',   true,  null, 'rustam_g'),
    ('zhanel',     'de000000-0000-4000-8000-000000000208', 'Жанель Нуржанова',        'zhanel',        7, 'algo',    'member',     null,         true,  null, 'zhanel_n'),
    ('alikhan',    'de000000-0000-4000-8000-000000000301', 'Алихан Серикбаев',        'alikhan',      11, 'startup', 'member',     'alikhan_s',  true,  'alikhan-s', null),
    ('varvara',    'de000000-0000-4000-8000-000000000302', 'Варвара Ким',             'varvara',      10, 'startup', 'member',     'varvara_k',  true,  'varvara-k', null),
    ('asel',       'de000000-0000-4000-8000-000000000303', 'Асель Жаксылыкова',       'asel',         10, 'startup', 'member',     null,         true,  null, null),
    ('maksim',     'de000000-0000-4000-8000-000000000304', 'Максим Орлов',            'maksim',        9, 'startup', 'member',     'maks_orlov', false, 'maks-orlov', null),
    ('diana',      'de000000-0000-4000-8000-000000000305', 'Диана Абдрахманова',      'diana',        11, 'startup', 'member',     'diana_a',    true,  'diana-a', null),
    ('bekzat',     'de000000-0000-4000-8000-000000000306', 'Бекзат Тулегенов',        'bekzat',       10, 'startup', 'member',     null,         true,  null, null),
    ('angelina',   'de000000-0000-4000-8000-000000000307', 'Ангелина Шевченко',       'angelina',      9, 'startup', 'member',     'angelina_sh', true, null, null),
    ('sanzhar',    'de000000-0000-4000-8000-000000000308', 'Санжар Мухамеджанов',     'sanzhar',      12, 'startup', 'member',     'sanzhar_m',  true,  'sanzhar-m', null),
    ('gleb',       'de000000-0000-4000-8000-000000000209', 'Глеб Соколов',            'gleb',          9, 'algo',    'member',     null,         true,  null, null);

  update demo_people set email = email || '@demo.aitclub.org';

  -- Sign-ups go through the same trigger as real ones (a join code makes the profile).
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', p.uid, 'authenticated', 'authenticated', p.email,
         extensions.crypt('demo-ait-2026', extensions.gen_salt('bf')), now(),
         '{"provider": "email", "providers": ["email"]}'::jsonb,
         jsonb_build_object(
           'full_name', p.full_name,
           'grade', coalesce(p.grade, 12),
           'join_code', (select code from public.join_codes where track_id = coalesce(p.track, 'ai') and active),
           'telegram', p.telegram,
           'photo_consent', p.photo),
         now() - interval '120 days', now(), '', '', '', ''
  from demo_people p;

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), p.uid, p.uid::text, 'email',
         jsonb_build_object('sub', p.uid::text, 'email', p.email, 'email_verified', true, 'phone_verified', false),
         now(), now(), now()
  from demo_people p;

  update public.profiles pr
  set role = d.role, track_id = d.track, grade = d.grade,
      github_username = d.github, codeforces_handle = d.codeforces,
      status = case when d.key = 'gleb' then 'inactive' else 'active' end
  from demo_people d
  where pr.user_id = d.uid;

  alter table demo_people add column pid uuid;
  update demo_people d set pid = pr.id from public.profiles pr where pr.user_id = d.uid;

  create function pg_temp.pid(p_key text) returns uuid
  language sql stable as $$ select pid from demo_people where key = p_key $$;

  -- ── The demo year: week 17 is the current week ─────────────────────────────────
  delete from public.cohort_weeks where cohort_id = public.default_cohort_id();
  insert into public.cohort_weeks (cohort_id, week_number, starts_on)
  select public.default_cohort_id(), n, date_trunc('week', current_date)::date - 16 * 7 + (n - 1) * 7
  from generate_series(1, 36) as n;

  -- A moment in a programme week: day 0 = Monday, local time in Petropavl (UTC+5).
  create function pg_temp.at(p_week int, p_day int, p_time text) returns timestamptz
  language sql stable as $$
    select ((starts_on + p_day)::text || ' ' || p_time || '+05')::timestamptz
    from public.cohort_weeks where cohort_id = public.default_cohort_id() and week_number = p_week
  $$;

  -- ── Teams ──────────────────────────────────────────────────────────────────────
  insert into public.teams (id, name, track_id, goal, captain_id, created_at) values
    ('de000000-0000-4000-9000-000000000001', 'EcoRoute', 'startup',
     'Карта пунктов приёма вторсырья в Петропавловске и запись на вывоз.', pg_temp.pid('alikhan'), pg_temp.at(3, 2, '17:00')),
    ('de000000-0000-4000-9000-000000000002', 'StudyBuddy', 'startup',
     'Напарник для подготовки к экзаменам из своей школы.', pg_temp.pid('diana'), pg_temp.at(3, 3, '17:00')),
    ('de000000-0000-4000-9000-000000000003', 'Столовая онлайн', 'startup',
     'Предзаказ обедов в школьной столовой без очереди.', pg_temp.pid('sanzhar'), pg_temp.at(4, 1, '17:00')),
    ('de000000-0000-4000-9000-000000000004', 'Градиентный спуск', 'ai',
     'Боты для турниров направления.', pg_temp.pid('daniyar'), pg_temp.at(6, 1, '17:00')),
    ('de000000-0000-4000-9000-000000000005', 'O(1)', 'algo',
     'Командные олимпиады по программированию.', pg_temp.pid('nursultan'), pg_temp.at(5, 2, '17:00'));

  insert into public.team_members (team_id, profile_id, joined_at)
  select t.team::uuid, pg_temp.pid(t.member), pg_temp.at(t.week, 2, '18:00')
  from (values
    ('de000000-0000-4000-9000-000000000001', 'alikhan', 3), ('de000000-0000-4000-9000-000000000001', 'varvara', 3),
    ('de000000-0000-4000-9000-000000000001', 'asel', 4),
    ('de000000-0000-4000-9000-000000000002', 'diana', 3), ('de000000-0000-4000-9000-000000000002', 'maksim', 3),
    ('de000000-0000-4000-9000-000000000002', 'bekzat', 4),
    ('de000000-0000-4000-9000-000000000003', 'sanzhar', 4), ('de000000-0000-4000-9000-000000000003', 'angelina', 4),
    ('de000000-0000-4000-9000-000000000004', 'daniyar', 6), ('de000000-0000-4000-9000-000000000004', 'erlan', 6),
    ('de000000-0000-4000-9000-000000000004', 'artem', 7),
    ('de000000-0000-4000-9000-000000000005', 'nursultan', 5), ('de000000-0000-4000-9000-000000000005', 'rustam', 5),
    ('de000000-0000-4000-9000-000000000005', 'tamerlan', 6)
  ) as t(team, member, week);

  insert into public.team_requests (team_id, profile_id, note, status, created_at) values
    ('de000000-0000-4000-9000-000000000004', pg_temp.pid('madina'),
     'Хочу участвовать в турнире ботов, Tic-Tac-Toe уже сдала.', 'pending', now() - interval '1 day');

  -- ── Projects ───────────────────────────────────────────────────────────────────
  insert into public.projects (id, title, problem, target_user, scope, roles, starts_on, ends_on,
                               verification, demo, links, status, team_id, owner_id, created_at) values
    ('de000000-0000-4000-a000-000000000001', 'EcoRoute',
     'В городе непонятно, где принимают пластик, стекло и макулатуру: пункты меняются, а информация разбросана по чатам.',
     'Жители Петропавловска, которые хотят сдавать вторсырьё, и школы, которые собирают макулатуру.',
     'Карта пунктов приёма с типами отходов и часами работы, заявка на вывоз для школ. Без приложения — веб-версия.',
     'Алихан — продукт и интервью; Варвара — фронтенд; Асель — данные о пунктах; Аружан (ИИ) — распознавание типа пластика по фото.',
     (select starts_on from public.cohort_weeks where week_number = 3), (select starts_on + 6 from public.cohort_weeks where week_number = 24),
     'Число заявок на вывоз и повторных посещений карты; 15 интервью до MVP.',
     'Живая карта на Demo Day и питч-разборе.',
     'https://github.com/ait-club-demo/ecoroute', 'active', 'de000000-0000-4000-9000-000000000001', pg_temp.pid('alikhan'), pg_temp.at(3, 4, '19:00')),
    ('de000000-0000-4000-a000-000000000002', 'Тренажёр олимпиадных задач для 7–8 классов',
     'Младшим школьникам сложно начать: задачи на CSES и Codeforces сразу слишком трудные и без объяснений на русском.',
     'Ученики 7–8 классов, которые готовятся к школьному этапу олимпиады.',
     'Подборка из 60 задач по темам с разборами и подсказками, контест раз в две недели.',
     'Полина — подбор задач; Камила — разборы; Жанель — тестирование на младших.',
     (select starts_on from public.cohort_weeks where week_number = 6), null,
     'Сколько младших решили хотя бы 10 задач за месяц.',
     'Открытый контест для 7–8 классов.',
     'https://github.com/ait-club-demo/olymp-trainer', 'active', null, pg_temp.pid('polina'), pg_temp.at(6, 2, '19:00')),
    ('de000000-0000-4000-a000-000000000003', 'Распознавание дорожных знаков на улицах города',
     'Модели из CS50 обучены на немецких знаках; на фото с улиц Петропавловска они ошибаются.',
     'Участники направления ИИ и все, кто хочет проверить модель на своих фото.',
     'Дообучить модель из проекта Traffic на 300 своих фотографиях и сравнить точность.',
     'Данияр — сбор и разметка данных; Ерлан — архитектура модели; Артём — оценка и отчёт.',
     (select starts_on from public.cohort_weeks where week_number = 5), (select starts_on + 6 from public.cohort_weeks where week_number = 12),
     'Точность на отложенной выборке своих фото: было 61%, стало 88%.',
     'Показ на Demo Day: модель распознаёт знаки с телефона.',
     'https://github.com/ait-club-demo/kz-traffic-signs', 'done', 'de000000-0000-4000-9000-000000000004', pg_temp.pid('daniyar'), pg_temp.at(5, 3, '19:00')),
    ('de000000-0000-4000-a000-000000000004', 'StudyBuddy',
     'Готовиться к экзаменам одному скучно, а найти напарника по тому же предмету и уровню трудно.',
     'Ученики 9–11 классов перед экзаменами.',
     'Анкета, подбор пары по предмету и времени, общий план подготовки.',
     'Диана — продукт; Максим — разработка; Бекзат — интервью и продвижение.',
     (select starts_on from public.cohort_weeks where week_number = 4), null,
     'Сколько пар продолжают заниматься через две недели.',
     'Демо подбора пары на питч-разборе.',
     'https://github.com/ait-club-demo/studybuddy', 'active', 'de000000-0000-4000-9000-000000000002', pg_temp.pid('diana'), pg_temp.at(4, 3, '19:00')),
    ('de000000-0000-4000-a000-000000000005', 'Бот расписания для школьного чата',
     'Расписание и замены публикуются картинкой, и в чате класса их приходится пересылать вручную.',
     'Ученики и классные руководители.',
     'Бот, который по запросу отвечает расписанием класса на сегодня и завтра.',
     'Никита — бот; Бекзат — разговоры с классными руководителями.',
     null, null, null, null, null, 'idea', null, pg_temp.pid('nikita'), pg_temp.at(15, 1, '19:00'));

  insert into public.project_members (project_id, profile_id, role, contribution, confirmed_by, confirmed_at, joined_at)
  select p.project::uuid, pg_temp.pid(p.member), p.role, p.contribution,
         case when p.confirmer is not null then pg_temp.pid(p.confirmer) end,
         case when p.confirmer is not null then pg_temp.at(p.week + 1, 1, '12:00') end,
         pg_temp.at(p.week, 0, '12:00')
  from (values
    ('de000000-0000-4000-a000-000000000001', 'alikhan', 'Продукт и интервью',
     'Провёл 14 интервью, собрал карту пунктов и ведёт доску задач.', 'lead_start', 3),
    ('de000000-0000-4000-a000-000000000001', 'varvara', 'Фронтенд',
     'Сделала лендинг, форму заявки и карту на React.', 'lead_start', 5),
    ('de000000-0000-4000-a000-000000000001', 'asel', 'Данные',
     'Собрала и проверила 42 пункта приёма с часами работы.', null, 4),
    ('de000000-0000-4000-a000-000000000001', 'aruzhan', 'Распознавание пластика',
     'Прототип модели, которая по фото отличает ПЭТ от других пластиков.', null, 9),
    ('de000000-0000-4000-a000-000000000002', 'polina', 'Подбор задач',
     'Отобрала 60 задач и разложила их по темам.', 'lead_algo', 6),
    ('de000000-0000-4000-a000-000000000002', 'kamila', 'Разборы',
     'Написала разборы к первым 20 задачам.', null, 7),
    ('de000000-0000-4000-a000-000000000002', 'zhanel', 'Тестирование', null, null, 8),
    ('de000000-0000-4000-a000-000000000003', 'daniyar', 'Данные',
     'Снял и разметил 310 фотографий знаков.', 'lead_ai', 5),
    ('de000000-0000-4000-a000-000000000003', 'erlan', 'Модель',
     'Подобрал архитектуру и дообучил модель.', 'lead_ai', 5),
    ('de000000-0000-4000-a000-000000000003', 'artem', 'Оценка',
     'Сравнил точность до и после, написал README с выводами.', 'lead_ai', 6),
    ('de000000-0000-4000-a000-000000000004', 'diana', 'Продукт',
     'Провела интервью и описала путь пользователя.', 'lead_start', 4),
    ('de000000-0000-4000-a000-000000000004', 'maksim', 'Разработка',
     'Собрал анкету и подбор пары на Supabase.', null, 6),
    ('de000000-0000-4000-a000-000000000004', 'bekzat', 'Интервью', null, null, 8),
    ('de000000-0000-4000-a000-000000000005', 'nikita', 'Бот', null, null, 15),
    ('de000000-0000-4000-a000-000000000005', 'bekzat', 'Интервью', null, null, 15)
  ) as p(project, member, role, contribution, confirmer, week);

  -- ── Events ─────────────────────────────────────────────────────────────────────
  -- Past events are written with their history (rules announced a week before, completed after),
  -- which the triggers would only allow over time — so they're off while the demo is laid out.
  alter table public.events disable trigger trg_events_before_write;
  alter table public.events disable trigger trg_events_after_write;
  delete from public.events;

  create temporary table demo_events (
    key text primary key, week int, day int, at text, type text, track text, title text,
    location text, responsible text, is_rated boolean, rules text, status text, description text
  );

  insert into demo_events values
    ('git',        3, 3, '16:00', 'workshop',     null,      'Воркшоп: Git и GitHub', 'Кабинет 214', 'director', false, null, 'completed',
     'Репозиторий, ветки, pull request — на своём проекте. Открыт для всех направлений.'),
    ('sim_clients', 4, 2, '15:30', 'simulation',  'startup', 'Симуляция поиска клиентов', 'Кабинет 305', 'lead_start', false, null, 'completed',
     'Все получают одинаковый кейс и предлагают свои решения.'),
    ('train',      5, 3, '15:30', 'contest',      'algo',    'Тренировочный контест', 'Кабинет 212', 'lead_algo', false, null, 'completed',
     'Нерейтинговый: привыкаем к формату и таймеру.'),
    ('case_hyp',   6, 2, '15:30', 'simulation',   'startup', 'Кейс: проверка гипотезы', 'Кабинет 305', 'lead_start', false, null, 'completed',
     'Все получают одинаковый кейс и предлагают свои решения.'),
    ('contest8',   8, 3, '15:30', 'contest',      'algo',    'Первый рейтинговый контест', 'Кабинет 212', 'lead_algo', true,
     E'5 задач, 2 часа, автоматическая проверка в группе клуба на Codeforces.\nМеста — по числу решённых задач, при равенстве — по штрафному времени.\nИзменение рейтинга: 1 место +150, 2 место +110, 3 место +80, 4–5 место +50, остальные участники +20.',
     'completed', 'После контеста — разбор и дорешивание.'),
    ('bots8',      8, 4, '16:00', 'tournament',   'ai',      'Турнир ботов: игры', 'Кабинет 210', 'lead_ai', true,
     E'Каждый бот играет с каждым по 10 партий в Tic-Tac-Toe на поле 4×4.\nМеста — по числу побед, при равенстве — по личной встрече.\nИзменение рейтинга: 1 место +150, 2 место +110, 3 место +80, 4–5 место +50, остальные участники +20.',
     'completed', 'Судейский скрипт и правила — в папке недели 8.'),
    ('demoday',    8, 5, '12:00', 'demo_day',     null,      'Demo Day — промежуточный показ', 'Актовый зал', 'director', false, null, 'completed',
     'Промежуточный показ работ всех трёх направлений. Гости — родители и учителя.'),
    ('contest9',   9, 3, '15:30', 'contest',      'algo',    'Контест клуба: итоги блока', 'Кабинет 212', 'lead_algo', true,
     E'6 задач по темам первого блока, 2 часа 30 минут.\nМеста — по числу решённых задач, при равенстве — по штрафному времени.\nИзменение рейтинга: 1 место +150, 2 место +110, 3 место +80, 4–5 место +50, остальные участники +20.',
     'completed', 'После контеста — разбор и дорешивание.'),
    ('minecraft', 10, 4, '18:00', 'club_evening', null,      'Клубный вечер на сервере Minecraft', 'Онлайн', 'director', false, null, 'completed',
     'Знакомство направлений между собой. Адрес сервера — в чате клуба.'),
    ('terminal',  12, 3, '16:00', 'workshop',     null,      'Воркшоп: терминал и Linux', 'Кабинет 214', 'lead_ai', false, null, 'completed',
     'Команды, которые нужны в cs50.dev и на олимпиадах.'),
    ('contest13', 13, 3, '15:30', 'contest',      'algo',    'Контест клуба', 'Кабинет 212', 'lead_algo', true,
     E'5 задач на графы и кратчайшие пути, 2 часа.\nМеста — по числу решённых задач, при равенстве — по штрафному времени.\nИзменение рейтинга: 1 место +150, 2 место +110, 3 место +80, 4–5 место +50, остальные участники +20.',
     'completed', 'После контеста — разбор и дорешивание.'),
    ('talkx',     14, 4, '17:00', 'talkx',        null,      'TalkX: как устроена работа ML-инженера', 'Актовый зал', 'director', false, null, 'completed',
     'Гость — ML-инженер из IT-компании Астаны. Вопросы можно прислать заранее руководителю направления.'),
    ('figma',     15, 3, '16:00', 'workshop',     null,      'Воркшоп: Figma', 'Кабинет 214', 'lead_start', false, null, 'cancelled',
     'Перенесён: ведущий заболел, новая дата будет в календаре.'),
    ('pitch1',    16, 3, '15:30', 'pitch_review', 'startup', 'Питч-разбор 1', 'Актовый зал', 'lead_start', true,
     E'Каждая команда: 3 минуты питча, 2 минуты демо, 5 минут вопросов.\nЖюри из трёх человек ставит до 10 баллов за проблему, продукт, трекшн и ответы.\nИзменение рейтинга команды: 1 место +150, 2 место +100, 3 место +60.',
     'completed', 'Каждая команда питчит свой проект и получает обратную связь.'),
    ('boardgames',17, 4, '17:30', 'club_evening', null,      'Клубный вечер: настольные игры', 'Кабинет 214', 'director', false, null, 'confirmed',
     'Неформальная встреча всех направлений.'),
    ('contest18', 18, 3, '15:30', 'contest',      'algo',    'Контест клуба: итоги блока', 'Кабинет 212', 'lead_algo', true,
     E'6 задач по темам второго блока, 2 часа 30 минут.\nМеста — по числу решённых задач, при равенстве — по штрафному времени.\nИзменение рейтинга: 1 место +150, 2 место +110, 3 место +80, 4–5 место +50, остальные участники +20.',
     'confirmed', 'После контеста — разбор и дорешивание.'),
    ('hackathon', 18, 5, '10:00', 'hackathon',    null,      'Хакатон: задачи из пройденных тем', 'Актовый зал', 'director', false, null, 'confirmed',
     'Контрольная неделя. Команды до пяти человек из любых направлений, задача — из тем первой половины года.'),
    ('case_unit', 19, 2, '15:30', 'simulation',   'startup', 'Кейс: юнит-экономика', 'Кабинет 305', 'lead_start', false, null, 'confirmed',
     'Все получают одинаковый кейс и предлагают свои решения.'),
    ('pitchws',   20, 3, '16:00', 'workshop',     null,      'Воркшоп: питч за три минуты', 'Кабинет 214', 'lead_start', false, null, 'confirmed',
     'Как рассказать о проекте коротко и понятно. Полезно всем направлениям.'),
    ('speed21',   21, 4, '16:00', 'tournament',   'ai',      'Турнир на скорость: задачи с ограничениями', 'Кабинет 210', 'lead_ai', true,
     E'Решатели участников запускаются на одной машине на 20 кроссвордах.\nСчитается число шагов поиска, время не меряется.\nИзменение рейтинга: 1 место +150, 2 место +110, 3 место +80, 4–5 место +50, остальные участники +20.',
     'confirmed', 'Судейский скрипт будет готов за две недели до турнира.'),
    ('sales21',   21, 2, '15:30', 'simulation',   'startup', 'Симуляция продаж', null, 'lead_start', false, null, 'draft',
     'Все получают одинаковый кейс и предлагают свои решения.'),
    ('contest22', 22, 3, '15:30', 'contest',      'algo',    'Контест клуба', null, 'lead_algo', false, null, 'draft',
     'Черновик: тема и правила появятся за неделю.'),
    ('pitch2',    24, 3, '15:30', 'pitch_review', 'startup', 'Питч-разбор 2', null, 'lead_start', false, null, 'draft',
     'Каждая команда питчит свой проект и получает обратную связь.'),
    ('bots25',    25, 4, '16:00', 'tournament',   'ai',      'Турнир ботов: игры с обучением', null, 'lead_ai', false, null, 'draft',
     'Боты на Q-learning из проекта Nim играют друг с другом.');

  alter table demo_events add column id uuid;
  update demo_events set id = gen_random_uuid();

  insert into public.events (id, type, title, track_id, starts_at, ends_at, location, description, responsible_id,
                             is_rated, rules, rules_published_at, status, created_by, created_at, updated_at)
  select e.id, e.type, e.title, e.track, pg_temp.at(e.week, e.day, e.at),
         case when e.type = 'hackathon' then pg_temp.at(e.week, e.day, e.at) + interval '1 day 8 hours' end,
         e.location, e.description, pg_temp.pid(e.responsible), e.is_rated, e.rules,
         case when e.is_rated and e.status <> 'draft'
              then least(pg_temp.at(e.week, e.day, e.at) - interval '7 days', now() - interval '2 days') end,
         e.status, pg_temp.pid(e.responsible), pg_temp.at(e.week, e.day, e.at) - interval '14 days',
         pg_temp.at(e.week, e.day, e.at) - interval '7 days'
  from demo_events e;

  alter table public.events enable trigger trg_events_before_write;
  alter table public.events enable trigger trg_events_after_write;

  create function pg_temp.event(p_key text) returns uuid
  language sql stable as $$ select id from demo_events where key = p_key $$;

  -- ── Published results of the rated events ─────────────────────────────────────
  alter table public.rating_results disable trigger trg_rating_results_before_write;

  insert into public.rating_results (event_id, profile_id, team_id, place, score, rating_delta, note, entered_by, created_at)
  select pg_temp.event(r.event), pg_temp.pid(r.member), null, r.place, r.score, r.delta, r.note,
         pg_temp.pid(case when r.event = 'bots8' then 'lead_ai' else 'lead_algo' end), now() - interval '1 day'
  from (values
    ('contest8', 'nursultan', 1, 5, 150, 'Все пять задач'), ('contest8', 'rustam', 2, 4, 110, null),
    ('contest8', 'polina', 3, 4, 80, null), ('contest8', 'tamerlan', 4, 3, 50, null),
    ('contest8', 'ivan', 5, 3, 50, null), ('contest8', 'aisulu', 6, 2, 20, null),
    ('contest8', 'kamila', 7, 2, 20, null), ('contest8', 'zhanel', 8, 1, 20, 'Первый контест — задача A решена'),
    ('contest9', 'rustam', 1, 6, 150, null), ('contest9', 'nursultan', 2, 5, 110, null),
    ('contest9', 'tamerlan', 3, 4, 80, null), ('contest9', 'polina', 4, 4, 50, null),
    ('contest9', 'aisulu', 5, 3, 50, null), ('contest9', 'ivan', 6, 3, 20, null),
    ('contest9', 'zhanel', 7, 2, 20, null), ('contest9', 'kamila', 8, 1, 20, null),
    ('contest13', 'nursultan', 1, 5, 150, null), ('contest13', 'polina', 2, 4, 110, 'Лучший результат за год'),
    ('contest13', 'rustam', 3, 4, 80, null), ('contest13', 'ivan', 4, 3, 50, null),
    ('contest13', 'tamerlan', 5, 3, 50, null), ('contest13', 'kamila', 6, 2, 20, null),
    ('contest13', 'aisulu', 7, 1, 20, null),
    ('bots8', 'daniyar', 1, 61, 150, 'Ни одного поражения'), ('bots8', 'erlan', 2, 55, 110, null),
    ('bots8', 'aruzhan', 3, 52, 80, null), ('bots8', 'artem', 4, 44, 50, null),
    ('bots8', 'sofia', 5, 37, 50, null), ('bots8', 'nikita', 6, 30, 20, null),
    ('bots8', 'aliya', 7, 18, 20, null), ('bots8', 'madina', 8, 9, 20, null)
  ) as r(event, member, place, score, delta, note);

  insert into public.rating_results (event_id, profile_id, team_id, place, score, rating_delta, note, entered_by, created_at)
  values
    (pg_temp.event('pitch1'), null, 'de000000-0000-4000-9000-000000000001', 1, 34, 150, 'Сильный трекшн: 31 заявка', pg_temp.pid('lead_start'), now() - interval '1 day'),
    (pg_temp.event('pitch1'), null, 'de000000-0000-4000-9000-000000000002', 2, 29, 100, null, pg_temp.pid('lead_start'), now() - interval '1 day'),
    (pg_temp.event('pitch1'), null, 'de000000-0000-4000-9000-000000000003', 3, 24, 60, 'Нужны интервью с поварами', pg_temp.pid('lead_start'), now() - interval '1 day');

  alter table public.rating_results enable trigger trg_rating_results_before_write;

  -- ── Works, their review and attendance (weeks 1–17) ─────────────────────────────
  create function pg_temp.roll(p_profile uuid, p_week int, p_salt text) returns int
  language sql immutable as $$ select abs(hashtext(p_profile::text || ':' || p_week || ':' || p_salt)) % 100 $$;

  create temporary table demo_lead (track text primary key, lead uuid);
  insert into demo_lead
  select 'ai', pg_temp.pid('lead_ai') union all
  select 'algo', pg_temp.pid('lead_algo') union all
  select 'startup', pg_temp.pid('lead_start');

  insert into public.submissions (profile_id, week_id, link, comment, status, feedback, reviewer_id, submitted_at, reviewed_at)
  select d.pid, w.id,
         case d.track
           when 'ai' then 'https://github.com/' || coalesce(d.github, 'ait-club-demo') || '/ai50-week-' || w.week_number
           when 'algo' then 'https://codeforces.com/profile/' || coalesce(d.codeforces, 'ait-club-demo')
           else 'https://github.com/ait-club-demo/' ||
                coalesce((select lower(replace(t.name, ' ', '-')) from public.team_members tm
                          join public.teams t on t.id = tm.team_id where tm.profile_id = d.pid), 'solo') ||
                '/week-' || w.week_number
         end,
         case when pg_temp.roll(d.pid, w.week_number, 'comment') < 20 then 'Не успел(а) на практикум, сделал(а) дома.' end,
         s.status,
         case s.status
           when 'needs_work' then case d.track
             when 'ai' then 'Не проходит check50: проверьте крайние случаи и пришлите снова.'
             when 'algo' then 'Решено 3 задачи из 5, дорешайте контест.'
             else 'Нет данных, на которых основано решение. Добавьте цифры из интервью.' end
           when 'accepted' then case when pg_temp.roll(d.pid, w.week_number, 'fb') < 25 then 'Хорошо, код объяснил(а).' end
         end,
         case when s.status <> 'submitted' then l.lead end,
         cw.starts_on + 4 + time '19:00' - interval '5 hours',
         case when s.status <> 'submitted' then cw.starts_on + 6 + time '12:00' - interval '5 hours' end
  from demo_people d
  join public.program_weeks w on w.track_id = d.track
  join public.cohort_weeks cw on cw.cohort_id = public.default_cohort_id() and cw.week_number = w.week_number
  join demo_lead l on l.track = d.track
  cross join lateral (
    select case
      when w.week_number = 17 then case when pg_temp.roll(d.pid, w.week_number, 's') < 35 then 'submitted' end
      when w.week_number = 16 and pg_temp.roll(d.pid, w.week_number, 's') < 45 then 'submitted'
      when w.week_number = 15 and pg_temp.roll(d.pid, w.week_number, 's') < 15 then 'submitted'
      when pg_temp.roll(d.pid, w.week_number, 's') < 7 then null
      when pg_temp.roll(d.pid, w.week_number, 's') < 15 then 'needs_work'
      else 'accepted'
    end as status
  ) s
  where d.role = 'member' and w.week_number <= 17 and s.status is not null
    and (d.key <> 'gleb' or w.week_number <= 5);

  insert into public.attendance (profile_id, week_id, kind, marked_by, marked_at)
  select d.pid, w.id, k.kind, l.lead, cw.starts_on + k.day + time '17:00' - interval '5 hours'
  from demo_people d
  join public.program_weeks w on w.track_id = d.track
  join public.cohort_weeks cw on cw.cohort_id = public.default_cohort_id() and cw.week_number = w.week_number
  join demo_lead l on l.track = d.track
  cross join (values ('lesson', 0, 78), ('practicum', 3, 70)) as k(kind, day, chance)
  where d.role = 'member' and w.week_number <= 16
    and pg_temp.roll(d.pid, w.week_number, k.kind) < k.chance
    and (d.key <> 'gleb' or w.week_number <= 5);

  -- ── AIT Points ────────────────────────────────────────────────────────────────
  -- An accepted weekly work earns 10; the rest are typical one-off entries.
  insert into public.points_entries (profile_id, amount, category, note, awarded_by, created_at)
  select s.profile_id, 10, 'required_work', 'Неделя ' || w.week_number || ': работа принята', s.reviewer_id, s.reviewed_at
  from public.submissions s join public.program_weeks w on w.id = s.week_id
  where s.status = 'accepted';

  insert into public.points_entries (profile_id, amount, category, note, awarded_by, created_at)
  select pg_temp.pid(p.member), p.amount, p.category, p.note, pg_temp.pid(p.awarder), pg_temp.at(p.week, 5, '12:00')
  from (values
    ('nursultan', 30, 'extra_work', '25 задач CSES сверх обязательных', 'lead_algo', 7),
    ('polina', 25, 'extra_work', 'Разборы задач для младших', 'lead_algo', 11),
    ('rustam', 15, 'extra_work', 'Дорешал все задачи контеста недели 9', 'lead_algo', 10),
    ('tamerlan', 10, 'team_help', 'Помог настроить среду C++ на практикуме', 'lead_algo', 2),
    ('kamila', 10, 'team_help', 'Объяснила бинарный поиск группе', 'lead_algo', 6),
    ('daniyar', 25, 'project_stage', 'Проект «Дорожные знаки» показан на Demo Day', 'lead_ai', 8),
    ('erlan', 25, 'project_stage', 'Проект «Дорожные знаки» показан на Demo Day', 'lead_ai', 8),
    ('artem', 25, 'project_stage', 'Проект «Дорожные знаки» показан на Demo Day', 'lead_ai', 8),
    ('aruzhan', 15, 'team_help', 'Помогла троим пройти check50 в Degrees', 'lead_ai', 5),
    ('sofia', 10, 'extra_work', 'Дополнительный блокнот с анализом данных', 'lead_ai', 3),
    ('nikita', 10, 'event', 'Участие в воркшопе по терминалу', 'lead_ai', 12),
    ('aliya', 10, 'event', 'Участие в воркшопе по Git', 'lead_ai', 3),
    ('alikhan', 25, 'project_stage', 'EcoRoute: MVP запущен, первые пользователи', 'lead_start', 12),
    ('varvara', 25, 'project_stage', 'EcoRoute: MVP запущен, первые пользователи', 'lead_start', 12),
    ('asel', 25, 'project_stage', 'EcoRoute: MVP запущен, первые пользователи', 'lead_start', 12),
    ('diana', 20, 'project_stage', 'StudyBuddy: 15 интервью и решение команды', 'lead_start', 5),
    ('maksim', 15, 'extra_work', 'Разобрался с авторизацией Supabase и показал команде', 'lead_start', 9),
    ('sanzhar', 10, 'event', 'Участие в симуляции поиска клиентов', 'lead_start', 4),
    ('angelina', 10, 'event', 'Участие в кейсе «Проверка гипотезы»', 'lead_start', 6),
    ('bekzat', 10, 'event', 'Участие в симуляции поиска клиентов', 'lead_start', 4),
    ('alikhan', 20, 'org_contribution', 'Помог провести Demo Day', 'director', 8),
    ('polina', 20, 'org_contribution', 'Вела регистрацию на Demo Day', 'director', 8),
    ('erlan', 15, 'org_contribution', 'Помог провести воркшоп по терминалу', 'director', 12),
    ('varvara', -10, 'correction', 'Исправление: участие в симуляции начислено дважды', 'lead_start', 7)
  ) as p(member, amount, category, note, awarder, week);

  -- Work beyond the required volume, a different amount for each member.
  insert into public.points_entries (profile_id, amount, category, note, awarded_by, created_at)
  select d.pid, 5 * (1 + pg_temp.roll(d.pid, 0, 'bonus') % 7), 'extra_work',
         case d.track when 'ai' then 'Дополнительный блокнот с разбором ошибок'
                      when 'algo' then 'Задачи CSES сверх обязательных'
                      else 'Дополнительные интервью с пользователями' end,
         l.lead, pg_temp.at(9 + pg_temp.roll(d.pid, 0, 'bonus-week') % 7, 4, '12:00')
  from demo_people d join demo_lead l on l.track = d.track
  where d.role = 'member' and d.key <> 'gleb' and pg_temp.roll(d.pid, 0, 'bonus-has') < 75;

  -- ── News ───────────────────────────────────────────────────────────────────────
  update public.news set published_at = pg_temp.at(1, 0, '09:00'), updated_at = pg_temp.at(1, 0, '09:00')
  where author_id is null;

  insert into public.news (title, body, link_url, track_id, pinned, author_id, published_at, updated_at)
  select n.title, n.body, n.link, n.track, n.pinned, pg_temp.pid(n.author),
         pg_temp.at(n.week, n.day, n.at), pg_temp.at(n.week, n.day, n.at)
  from (values
    ('Расписание встреч на полугодие',
     E'Занятия — по понедельникам, практикумы — по четвергам, в 15:30 в кабинетах 210, 212 и 305.\nЕсли не можете прийти, работа всё равно сдаётся до воскресенья: материалы недели лежат в Drive.',
     null, null, false, 'director', 1, 2, '18:00'),
    ('Первый рейтинговый контест — в четверг',
     E'Пять задач, два часа, группа клуба на Codeforces. Правила уже в календаре.\nВозьмите ноутбук с настроенным C++ и проверьте, что заходите в группу.',
     null, 'algo', false, 'lead_algo', 7, 4, '19:00'),
    ('Турнир ботов: судейский скрипт готов',
     E'Скрипт и правила — в папке недели 8. Бота сдаёте до среды ссылкой на репозиторий.\nНа поле 4×4 минимакс без отсечений не успеет — подумайте про альфа-бету.',
     null, 'ai', false, 'lead_ai', 7, 1, '20:00'),
    ('Как прошёл Demo Day',
     E'Девять работ, три направления и больше пятидесяти гостей. Спасибо всем, кто показывал и помогал с организацией!\nЛучшие проекты попадут в базу проектов Hub — проверьте, что вклад каждого в команде записан.',
     null, null, false, 'director', 9, 0, '17:00'),
    ('Питч-разбор 1: порядок выступлений',
     E'EcoRoute, StudyBuddy, Столовая онлайн. У каждой команды 3 минуты питча, 2 минуты демо и 5 минут вопросов.\nДеки загрузите в папку недели 16 до среды.',
     null, 'startup', false, 'lead_start', 15, 2, '18:30'),
    ('Хакатон на контрольной неделе',
     E'В субботу 18-й недели — хакатон по темам первой половины года. Команды до пяти человек из любых направлений.\nЗапишитесь у руководителя направления до четверга.',
     null, null, true, 'director', 17, 0, '10:00'),
    ('Курс CS50 AI: полезные ссылки',
     'Конспекты лекций и тексты всех двенадцати проектов — на сайте курса. В папке недели — наши слайды и стартовые файлы.',
     'https://cs50.harvard.edu/ai/', 'ai', false, 'lead_ai', 2, 1, '19:30')
  ) as n(title, body, link, track, pinned, author, week, day, at);

  -- ── Audit trail ───────────────────────────────────────────────────────────────
  insert into public.audit_log (actor_id, action, target_id, details, created_at) values
    (pg_temp.pid('director'), 'schedule_set', null, '{"last_week": 36}', pg_temp.at(1, 0, '08:00') - interval '7 days'),
    (pg_temp.pid('director'), 'role_changed', pg_temp.pid('lead_ai'), '{"from": "member", "to": "track_lead"}', pg_temp.at(1, 0, '08:30') - interval '7 days'),
    (pg_temp.pid('director'), 'role_changed', pg_temp.pid('lead_algo'), '{"from": "member", "to": "track_lead"}', pg_temp.at(1, 0, '08:31') - interval '7 days'),
    (pg_temp.pid('director'), 'role_changed', pg_temp.pid('lead_start'), '{"from": "member", "to": "track_lead"}', pg_temp.at(1, 0, '08:32') - interval '7 days'),
    (pg_temp.pid('lead_ai'), 'join_code_rotated', null, '{"track": "ai"}', pg_temp.at(2, 1, '15:00')),
    (pg_temp.pid('director'), 'status_changed', pg_temp.pid('gleb'), '{"from": "active", "to": "inactive"}', pg_temp.at(7, 2, '16:00')),
    (pg_temp.pid('lead_algo'), 'event_completed', null, jsonb_build_object('title', 'Первый рейтинговый контест'), pg_temp.at(8, 4, '18:00')),
    (pg_temp.pid('lead_ai'), 'event_completed', null, jsonb_build_object('title', 'Турнир ботов: игры'), pg_temp.at(8, 5, '10:00')),
    (pg_temp.pid('lead_start'), 'event_completed', null, jsonb_build_object('title', 'Питч-разбор 1'), pg_temp.at(16, 4, '10:00')),
    (pg_temp.pid('curator'), 'export_members', null, '{}', pg_temp.at(12, 2, '11:00'));

  drop table demo_people, demo_events, demo_lead;
end;
$seed$;
