-- One catalog entry kept the tail of a research note («10.2026 до дедлайна 3 дня»): the clean-up
-- took the dot inside a date for the end of the sentence. The generator is fixed; this removes the
-- leftover where the first load already happened.
update public.opportunities
set notes = nullif(btrim(regexp_replace(notes, '^10\.2026 до дедлайна 3 дня\.\s*', '')), '')
where key = 'sko-hub-pizza-pitch' and notes like '10.2026 до дедлайна%';
