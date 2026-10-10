// Builds the migration that fills the catalog of competitions and opportunities from the
// research lists in this folder (collected from official sites in October 2026):
//
//   node scripts/catalog/build.mjs  →  supabase/migrations/20261012130000_opportunities_content.sql
//
// Each list is an array of entries in one shape (see any .json here). Entries that several lists
// found are merged under one key: the fullest description wins, sources are combined. Rows are
// inserted with `on conflict (key) do nothing`, so edits made in the Hub are never overwritten.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('.', import.meta.url))
const OUT = fileURLToPath(new URL('../../supabase/migrations/20261012130000_opportunities_content.sql', import.meta.url))
const LISTS = ['olympiads', 'ai', 'startup', 'programs']

// A stable key per entry, by the start of its title.
const KEYS = [
  ['Республиканская олимпиада по информатике (9', 'respa-informatics'],
  ['Республиканская олимпиада по информатике для 7', 'respa-informatics-junior'],
  ['Международная Жаутыковская', 'izho-informatics'],
  ['Евразийская командная', 'eurasian-team-olympiad'],
  ['Национальная сборная Казахстана по информатике', 'ioi-team-kz'],
  ['Европейская юниорская', 'ejoi-2027'],
  ['USACO', 'usaco'],
  ['Раунды Codeforces', 'codeforces'],
  ['AtCoder', 'atcoder'],
  ['Innopolis Open', 'innopolis-open'],
  ['Международная олимпиада «Туймаада»', 'tuymaada-informatics'],
  ['Международная олимпиада по искусственному интеллекту IOAI', 'ioai-2027'],
  ['AI Olymp', 'ai-olymp'],
  ['International Artificial Intelligence Olympiad', 'iaio-2027'],
  ['FAIO', 'faio'],
  ['Соревнования Kaggle', 'kaggle-competitions'],
  ['Kaggle Learn', 'kaggle-learn'],
  ['Соревнования Zindi', 'zindi'],
  ['Technovation', 'technovation'],
  ['WAICY', 'waicy-2026'],
  ["CS50's Introduction to Artificial Intelligence", 'cs50-ai'],
  ['Elements of AI', 'elements-of-ai'],
  ['Республиканский хакатон для школьников', 'republican-school-hackathon'],
  ['Хакатон ITFest', 'itfest-hackathon'],
  ['NASA Space Apps', 'nasa-space-apps-petropavlovsk'],
  ['Conrad Challenge', 'conrad-challenge'],
  ['Diamond Challenge', 'diamond-challenge'],
  ['The Earth Prize', 'earth-prize'],
  ['Blue Ocean', 'blue-ocean'],
  ['Samsung Solve for Tomorrow', 'samsung-solve-for-tomorrow'],
  ['Infomatrix-Asia', 'infomatrix-asia'],
  ['TAU-InnoHub', 'tau-innohub-school'],
  ['Startup Orda', 'startup-orda-sko'],
  ['Стажировка SKO Hub', 'sko-hub-internship'],
  ['Career Map', 'sko-hub-career-map'],
  ['PIZZA PITCH', 'sko-hub-pizza-pitch'],
  ['IDEA BATTLE', 'idea-battle'],
  ['Tomorrow School', 'tomorrow-school'],
  ['TUMO Astana', 'tumo-astana'],
  ['Samsung Innovation Campus', 'samsung-innovation-campus'],
  ['ACTS x CPFED', 'acts-cpfed'],
  ['Стипендия JetBrains Foundation', 'jetbrains-csai-scholarship'],
  ['Hack Club', 'hack-club'],
  ['Beginit', 'beginit'],
]

// Corrections after reading the lists: no names of school students, one shape for merged entries.
const EDITS = {
  'ioai-2027': (e) => ({
    ...e,
    description: e.description.replace(
      /В 2026 году все 8 участников сборной Казахстана завоевали медали \(2 из них золотые\), а [^.]+\./,
      'В 2026 году все 8 участников сборной Казахстана завоевали медали, 2 из них — золотые.',
    ),
  }),
  'ioi-team-kz': (e) => ({ ...e, description: e.description.replace(/ученик РФМШ [А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+/, 'ученик РФМШ') }),
  technovation: (e) => ({
    ...e,
    title: 'Technovation Challenge 2026–2027 (Technovation Girls и смешанный трек)',
    kind: 'competition',
    region: 'online',
    grade_min: 7,
    grade_max: 12,
  }),
  'republican-school-hackathon': (e) => ({ ...e, title: 'Республиканский хакатон для школьников (Astana Daryn × CAP Education × Astana Hub)' }),
  beginit: (e) => ({
    ...e,
    hidden: true,
    notes: 'Скрыто от участников: по данным на октябрь 2026 программа, вероятно, приостановлена. Откройте запись, когда объявят новый набор. ' + (e.notes ?? ''),
  }),
}

// The research lists carry a few notes meant for whoever compiles the catalog (field names,
// "N days left" as of the day of research); members get the facts.
const TIDY = [
  [/\s*Срочно:[^.]*\./g, ''],
  [/\s*На 10 октября 2026 до дедлайна[^.]*\./g, ''],
  [/\s*На 10\.10\.2026 страница для учеников[^.]*\./g, ''],
  [/ — поэтому region указан как online, хотя финал проходит за рубежом/g, ''],
  [/В deadline (?:указан|—) дедлайн регистрации; /g, 'Срок в карточке — окончание регистрации; '],
  [/ \(указан[аоы]? в event_start\/event_end\)/g, ''],
  [/ — перед публикацией в каталоге стоит уточнить у SKO Hub/g, ' — уточните у SKO Hub'],
  [/(на|На) 10\.10\.2026/g, '$1 10 октября 2026'],
]
const tidy = (e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [
  k,
  typeof v === 'string' ? TIDY.reduce((text, [re, to]) => text.replace(re, to), v).trim() : v,
]))

const LIMITS = {
  title: 200, organizer: 400, eligibility: 2000, team: 600, fee: 800, summary: 600, description: 6000,
  how_to_apply: 2000, dates_note: 1500, notes: 2000,
}
const KINDS = ['olympiad', 'competition', 'hackathon', 'startup', 'program', 'camp', 'internship', 'grant', 'course', 'event']
const REGIONS = ['sko', 'kz', 'online', 'intl']

const keyOf = (title) => {
  const hit = KEYS.find(([prefix]) => title.startsWith(prefix))
  if (!hit) throw new Error(`No key for «${title}»`)
  return hit[1]
}
const filled = (e) => Object.values(e).filter((v) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)).length

const byKey = new Map()
for (const list of LISTS) {
  for (const entry of JSON.parse(readFileSync(`${DIR}${list}.json`, 'utf8'))) {
    const key = keyOf(entry.title)
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, entry)
      continue
    }
    // Keep the entry with confirmed dates and the longer description; combine the sources.
    const score = (e) => (e.verified ? 1e6 : 0) + (e.description?.length ?? 0) + filled(e)
    const [keep, other] = score(entry) > score(prev) ? [entry, prev] : [prev, entry]
    byKey.set(key, { ...keep, sources: [...new Set([...(keep.sources ?? []), ...(other.sources ?? [])])] })
  }
}

const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const date = (v) => (v ? `date ${q(v)}` : 'null')
const arr = (list) => (list.length ? `array[${list.map(q).join(', ')}]` : `'{}'::text[]`)

const rows = []
for (const [key, raw] of byKey) {
  const e = tidy(EDITS[key] ? EDITS[key](raw) : raw)
  for (const [field, max] of Object.entries(LIMITS)) {
    if ((e[field] ?? '').length > max) throw new Error(`${key}: ${field} is ${e[field].length} > ${max}`)
  }
  if (!KINDS.includes(e.kind) || !REGIONS.includes(e.region)) throw new Error(`${key}: kind/region`)
  const sources = (e.sources ?? []).filter((s) => /^https:\/\//i.test(s)).slice(0, 12)
  for (const link of [e.url, e.apply_url].filter(Boolean)) {
    if (!/^https:\/\//i.test(link)) throw new Error(`${key}: ${link} is not https`)
  }
  const tracks = (e.tracks ?? []).filter((t) => ['ai', 'algo', 'startup'].includes(t))
  rows.push(`  (${[
    q(key), q(e.title.trim()), q(e.kind), q(e.organizer), arr(tracks), q(e.region),
    e.grade_min ?? 'null', e.grade_max ?? 'null', q(e.eligibility), q(e.team), q(e.fee), q(e.summary.trim()),
    q(e.description), q(e.how_to_apply), q(e.url), q(e.apply_url), date(e.deadline), date(e.event_start),
    date(e.event_end), q(e.dates_note), e.verified ? 'true' : 'false', arr(sources), q(e.notes),
    e.hidden ? 'true' : 'false',
  ].join(', ')})`)
}

const sql = `-- The catalog's first ${rows.length} entries: olympiads, contests, hackathons, startup programmes,
-- camps, internships, grants and courses open to the club's members, collected from official
-- sites and Kazakh news on 10 October 2026 (generated by scripts/catalog/build.mjs from the
-- lists next to it). Dates are filled only where an official page confirmed the current season;
-- otherwise dates_note says what is known. Entries the Hub has edited since are left alone.

insert into public.opportunities (key, title, kind, organizer, tracks, region, grade_min, grade_max,
  eligibility, team, fee, summary, description, how_to_apply, url, apply_url, deadline, starts_on,
  ends_on, dates_note, dates_verified, sources, notes, hidden)
values
${rows.join(',\n')}
on conflict (key) do nothing;
`
writeFileSync(OUT, sql)
console.log(`${rows.length} entries → ${OUT}`)
