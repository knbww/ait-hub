-- The form asks each thing once (9 November 2026, the first day of the round):
--
--  * Education no longer asks for the preferred mentor role in its questions: the role chosen in
--    step 2 is the answer, and «both» is the other mentor role chosen as the extra one.
--  * Experience is asked once, by each department in its own words: the general question of step 1
--    is gone, and PR & Creative gets a question of its own (optional, like Operations' and Data's).
--
-- Applications already sent keep their answers as they are. scripts/db-test.mjs checks the form's
-- options against this function through src/lib/recruitment.ts.

create or replace function private.application_answers(p_form jsonb, p_department text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  a       jsonb := coalesce(p_form -> 'answers', '{}'::jsonb);
  v_tools text[];
begin
  if jsonb_typeof(a) <> 'object' then
    raise exception 'invalid_form' using detail = 'answers';
  end if;

  if p_department = 'education' then
    return jsonb_strip_nulls(jsonb_build_object(
      'direction',    private.form_choice(a, 'direction', array['ai', 'algo', 'startup']),
      'skills',       private.form_field(a, 'skills', 1500, true, true),
      'achievements', private.form_field(a, 'achievements', 1500, true, true),
      'links',        to_jsonb(private.form_links(a, 'links')),
      'explain',      private.form_field(a, 'explain', 1000, true, true),
      'tasks',        to_jsonb(private.form_choices(a, 'tasks',
                        array['theory', 'practice', 'review', 'materials', 'co_teaching', 'substitute'])),
      'solo_lesson',  private.form_choice(a, 'solo_lesson', array['yes', 'after_prep', 'not_yet']),
      'substitute',   private.form_choice(a, 'substitute', array['yes', 'sometimes', 'no'])
    ));
  elsif p_department = 'pr' then
    v_tools := private.form_choices(a, 'tools',
      array['figma', 'canva', 'adobe', 'capcut', 'premiere', 'instagram', 'telegram', 'other']);
    return jsonb_strip_nulls(jsonb_build_object(
      'tools',       to_jsonb(v_tools),
      'tools_other', case when 'other' = any (v_tools) then private.form_field(a, 'tools_other', 120, false) end,
      'tasks',       to_jsonb(private.form_choices(a, 'tasks',
                       array['smm', 'content_plan', 'posters', 'reels', 'texts', 'interviews', 'community', 'analytics'])),
      'pr_experience', private.form_field(a, 'pr_experience', 1500, false, true),
      'links',       to_jsonb(private.form_links(a, 'links')),
      'idea',        private.form_field(a, 'idea', 1500, true, true),
      'style',       private.form_choice(a, 'style', array['own', 'team', 'both']),
      'after_week',  private.form_choice(a, 'after_week', array['yes', 'limited', 'projects'])
    ));
  elsif p_department = 'operations' then
    return jsonb_strip_nulls(jsonb_build_object(
      'tasks',          to_jsonb(private.form_choices(a, 'tasks',
                          array['events', 'schedules', 'interviews', 'candidates', 'speakers', 'partners', 'schools', 'documents'])),
      'org_experience', private.form_field(a, 'org_experience', 1500, false, true),
      'case',           private.form_field(a, 'case', 1500, true, true),
      'tracking',       private.form_field(a, 'tracking', 1000, true, true),
      'outreach',       private.form_choice(a, 'outreach', array['yes', 'with_guidance', 'internal'])
    ));
  elsif p_department = 'data' then
    v_tools := private.form_choices(a, 'tools', array['sheets', 'excel', 'python', 'sql', 'bi', 'other', 'none']);
    if 'none' = any (v_tools) and cardinality(v_tools) > 1 then
      raise exception 'invalid_form' using detail = 'tools';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'tools',           to_jsonb(v_tools),
      'tools_other',     case when 'other' = any (v_tools) then private.form_field(a, 'tools_other', 120, false) end,
      'interests',       to_jsonb(private.form_choices(a, 'interests',
                           array['registrations', 'attendance', 'assignments', 'activity', 'ait_week', 'social', 'dashboards'])),
      'data_experience', private.form_field(a, 'data_experience', 1500, false, true),
      'metrics',         private.form_field(a, 'metrics', 1000, true, true),
      'reports',         private.form_choice(a, 'reports', array['yes', 'schedule', 'oneoff']),
      'privacy',         private.form_field(a, 'privacy', 1000, true, true)
    ));
  end if;
  raise exception 'invalid_form' using detail = 'department';
end;
$$;
