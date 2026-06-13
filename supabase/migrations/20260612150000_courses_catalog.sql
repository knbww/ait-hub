-- Course catalogue: give the seeded course a real syllabus link (so the card's
-- «Открыть программу» button appears) and add a few enrollable courses (so the
-- «Записаться» picker has options). All admin-managed, public-read (existing RLS).

update public.courses
  set syllabus_url = 'https://cs50.harvard.edu/ai/',
      duration     = '12 недель',
      level        = 'Средний'
  where id = '10000000-0000-0000-0000-000000000001';

insert into public.courses (id, title, instructor, duration, level, syllabus_url) values
  ('10000000-0000-0000-0000-000000000002', 'Fast.ai — Practical Deep Learning', 'Jeremy Howard',
   '8 недель', 'Продвинутый', 'https://course.fast.ai/'),
  ('10000000-0000-0000-0000-000000000003', 'Kaggle — Intro to ML', 'Kaggle',
   '3 часа', 'Начальный', 'https://www.kaggle.com/learn/intro-to-machine-learning'),
  ('10000000-0000-0000-0000-000000000004', 'DeepLearning.AI — ML Specialization', 'Andrew Ng',
   '3 месяца', 'Средний', 'https://www.coursera.org/specializations/machine-learning-introduction')
on conflict (id) do nothing;
