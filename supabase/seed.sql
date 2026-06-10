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

insert into public.courses (id, title, instructor, duration, level) values
  ('10000000-0000-0000-0000-000000000001', 'Harvard CS50 AI', 'David J. Malan', '12 Weeks', 'Intermediate');

insert into public.enrollments (profile_id, course_id, progress) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 60);

insert into public.projects (owner_id, title, progress) values
  ('00000000-0000-0000-0000-000000000001', 'Sample Project Title', 75),
  ('00000000-0000-0000-0000-000000000001', 'Sample Project Title', 40);
