-- Seed data — ports the original prototype's mock arrays so a freshly migrated
-- project shows the same content. Re-applied by `supabase db reset`.

insert into public.profiles (id, full_name, role, avatar_url, bio) values
  ('00000000-0000-0000-0000-000000000001', 'Anna',             'member', '', 'Core Member'),
  ('00000000-0000-0000-0000-000000000002', 'Akylbek Eslambek', 'member', '', null),
  ('00000000-0000-0000-0000-000000000003', 'Steve Smith',      'member', '', null),
  ('00000000-0000-0000-0000-000000000004', 'Jom Daser',        'member', '', null),
  ('00000000-0000-0000-0000-000000000005', 'Mary Joe',         'member', '', null),
  ('00000000-0000-0000-0000-000000000006', 'Allen Winor',      'member', '', null),
  ('00000000-0000-0000-0000-000000000007', 'John Doe',         'mentor', '', 'ML Engineer'),
  ('00000000-0000-0000-0000-000000000008', 'Sarah Smith',      'mentor', '', 'Research Scientist');

insert into public.xp_events (profile_id, source, delta) values
  ('00000000-0000-0000-0000-000000000002', 'seed', 2200),
  ('00000000-0000-0000-0000-000000000003', 'seed', 300),
  ('00000000-0000-0000-0000-000000000004', 'seed', 200),
  ('00000000-0000-0000-0000-000000000005', 'seed', 120),
  ('00000000-0000-0000-0000-000000000006', 'seed', 50);

insert into public.proof_of_work (profile_id, period, task, status) values
  ('00000000-0000-0000-0000-000000000001', 'Dec 2025', 'Started NLP Research', 'completed'),
  ('00000000-0000-0000-0000-000000000001', 'Jan 2026', '50th GitHub Commit',   'completed'),
  ('00000000-0000-0000-0000-000000000001', 'Feb 2026', 'Submit to ISEF',       'pending');

insert into public.skills (profile_id, skill, level, category) values
  ('00000000-0000-0000-0000-000000000001', 'Python',         90, 'Programming'),
  ('00000000-0000-0000-0000-000000000001', 'PyTorch',        75, 'ML Framework'),
  ('00000000-0000-0000-0000-000000000001', 'Linear Algebra', 85, 'Math'),
  ('00000000-0000-0000-0000-000000000001', 'Git',            95, 'Tools'),
  ('00000000-0000-0000-0000-000000000001', 'OpenCV',         70, 'Computer Vision');

insert into public.research_papers (author_name, title, tags, citations) values
  ('Team Alpha', 'Neural Networks in Computer Vision', array['Computer Vision', 'Deep Learning'], 12),
  ('Anna Name',  'Ethics in AI Development',           array['Ethics', 'AI'],                     8),
  ('Marc Name',  'NLP for Kazakh Language',            array['NLP', 'Research'],                  15);

insert into public.deadlines (title, due_date, scope) values
  ('ISEF Registration', '2026-02-15', 'global'),
  ('MIT Early Action',  '2026-11-01', 'global'),
  ('AI Hackathon',      '2026-03-20', 'global');

insert into public.courses (id, title, instructor, duration, level, syllabus_url) values
  ('10000000-0000-0000-0000-000000000001', 'Harvard CS50 AI', 'David J. Malan', '12 недель', 'Средний', 'https://cs50.harvard.edu/ai/'),
  ('10000000-0000-0000-0000-000000000002', 'Fast.ai — Practical Deep Learning', 'Jeremy Howard', '8 недель', 'Продвинутый', 'https://course.fast.ai/'),
  ('10000000-0000-0000-0000-000000000003', 'Kaggle — Intro to ML', 'Kaggle', '3 часа', 'Начальный', 'https://www.kaggle.com/learn/intro-to-machine-learning'),
  ('10000000-0000-0000-0000-000000000004', 'DeepLearning.AI — ML Specialization', 'Andrew Ng', '3 месяца', 'Средний', 'https://www.coursera.org/specializations/machine-learning-introduction');

insert into public.enrollments (profile_id, course_id, progress) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 60);

insert into public.projects (owner_id, title, progress) values
  ('00000000-0000-0000-0000-000000000001', 'Sample Project Title', 75),
  ('00000000-0000-0000-0000-000000000001', 'Sample Project Title', 40);

-- Teams & help board (Module 5).
insert into public.teams (id, name, goal, founder_id, needed_roles, status) values
  ('40000000-0000-0000-0000-000000000001', 'Студия: ИИ-ассистент',
   'Собрать ИИ-ассистента для школы', '00000000-0000-0000-0000-000000000001',
   array['build', 'data'], 'forming');
insert into public.team_members (team_id, profile_id, role) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'founder');
insert into public.help_requests (requester_id, title, description) values
  ('00000000-0000-0000-0000-000000000002', 'Нужна помощь с PyTorch',
   'Не сходится обучение модели — нужен совет по гиперпараметрам.');

-- Start challenge (Module 6).
insert into public.challenges (id, title, description, rules, starter_url, status, deadline) values
  ('30000000-0000-0000-0000-000000000001',
   'Стартовый челлендж: ИИ за выходные',
   'Соберите маленький ИИ-проект за выходные и покажите демо.',
   'Любой язык и фреймворк. Результат — публичная ссылка (GitHub / Colab / видео). Один участник — одна работа.',
   'https://www.kaggle.com/learn', 'open', '2026-09-30T23:59:00Z');

-- Academy: an active Season 1 with a 9-week program (Module 3).
insert into public.seasons (id, title, description, start_date, week_count, status) values
  ('20000000-0000-0000-0000-000000000001',
   'Season 1 — AI Foundations',
   'Девятинедельный вводный сезон: от среды разработки до защиты собственного ИИ-продукта.',
   '2026-09-01', 9, 'active');

insert into public.season_weeks
  (id, season_id, week_number, topic, description, course_url, colab_url, kaggle_url, assignment_brief, due_date) values
  ('20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001', 1,
   'Среда и инструменты', 'Git, Colab, Kaggle и Python-окружение.',
   'https://cs50.harvard.edu/ai/', 'https://colab.research.google.com/', 'https://www.kaggle.com/learn',
   'Завести GitHub-репозиторий и прислать ссылку на первый коммит.', '2026-09-07'),
  ('20000000-0000-0000-0000-000000000102', '20000000-0000-0000-0000-000000000001', 2,
   'Python для ML', 'NumPy, pandas и визуализация данных.',
   null, 'https://colab.research.google.com/', 'https://www.kaggle.com/learn/pandas',
   'Ноутбук с разведочным анализом любого датасета.', '2026-09-14'),
  ('20000000-0000-0000-0000-000000000103', '20000000-0000-0000-0000-000000000001', 3,
   'Математика для ML', 'Линейная алгебра и основы статистики.',
   null, null, null,
   'Реализовать матричные операции вручную на NumPy.', '2026-09-21'),
  ('20000000-0000-0000-0000-000000000104', '20000000-0000-0000-0000-000000000001', 4,
   'Классическое ML', 'scikit-learn: регрессия и классификация.',
   null, 'https://colab.research.google.com/', 'https://www.kaggle.com/learn/intro-to-machine-learning',
   'Обучить модель на Kaggle-датасете и приложить метрики.', '2026-09-28'),
  ('20000000-0000-0000-0000-000000000105', '20000000-0000-0000-0000-000000000001', 5,
   'Нейросети: основы', 'Перцептрон, обратное распространение, PyTorch.',
   null, 'https://colab.research.google.com/', null,
   'Собрать и обучить простую нейросеть на MNIST.', '2026-10-05'),
  ('20000000-0000-0000-0000-000000000106', '20000000-0000-0000-0000-000000000001', 6,
   'Компьютерное зрение', 'CNN и работа с изображениями.',
   null, 'https://colab.research.google.com/', 'https://www.kaggle.com/learn/computer-vision',
   'Классификатор изображений с отчётом о точности.', '2026-10-12'),
  ('20000000-0000-0000-0000-000000000107', '20000000-0000-0000-0000-000000000001', 7,
   'NLP и языковые модели', 'Токенизация, эмбеддинги, трансформеры.',
   null, 'https://colab.research.google.com/', null,
   'Демо текстовой задачи (классификация или генерация).', '2026-10-19'),
  ('20000000-0000-0000-0000-000000000108', '20000000-0000-0000-0000-000000000001', 8,
   'Проект: архитектура и MVP', 'От идеи к работающему прототипу.',
   null, null, null,
   'Архитектура проекта + работающий MVP в репозитории.', '2026-10-26'),
  ('20000000-0000-0000-0000-000000000109', '20000000-0000-0000-0000-000000000001', 9,
   'Финальная защита продукта', 'Демо-день: защита собственного ИИ-продукта.',
   null, null, null,
   'Видео-демо продукта + ссылка на репозиторий.', '2026-11-02');

-- A couple of submissions from Anna so a fresh DB shows the status lifecycle.
insert into public.submissions
  (id, week_id, profile_id, link, comment, status, passed, feedback, reviewed_at) values
  ('20000000-0000-0000-0000-000000000201', '20000000-0000-0000-0000-000000000101',
   '00000000-0000-0000-0000-000000000001', 'https://github.com/knbww/week-1', 'Готово!',
   'reviewed', true, 'Отличный старт — чистый репозиторий.', now()),
  ('20000000-0000-0000-0000-000000000202', '20000000-0000-0000-0000-000000000102',
   '00000000-0000-0000-0000-000000000001', 'https://colab.research.google.com/anna-eda', 'EDA по Titanic.',
   'submitted', null, null, null);

-- Matching attendance + AIP so the leaderboard stays consistent with the demo.
insert into public.attendance (week_id, profile_id) values
  ('20000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001');

insert into public.xp_events (profile_id, source, delta, ref) values
  ('00000000-0000-0000-0000-000000000001', 'attendance', 10, 'attendance:20000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000001', 'assignment', 20, 'assignment:20000000-0000-0000-0000-000000000201');
