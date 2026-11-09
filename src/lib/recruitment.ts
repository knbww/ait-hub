// Team recruitment: departments, roles and every question of the «Join Our Team» form, in one
// place. The form on aitclub.org/team (site/team-form.ts) draws itself from this, the Hub shows
// answers with these labels (src/pages/Recruitment*.tsx), and scripts/db-test.mjs checks that the
// database accepts exactly these options (supabase/migrations/20261109120000_team_recruitment.sql
// repeats the lists: change both together).
//
// The texts address the applicant as «ты», as the form does. No imports: Node runs this file as is
// in the database tests.

export type DepartmentId = 'education' | 'pr' | 'operations' | 'data'
export type RoleId =
  | 'lead_mentor' | 'co_mentor'
  | 'smm' | 'designer' | 'video' | 'copywriter' | 'community'
  | 'operations_manager' | 'event_manager' | 'hr' | 'partnerships' | 'ambassadors'
  | 'data_manager'
export type ApplicantStatus = 'nis_student' | 'nis_graduate' | 'university' | 'other'
export type ApplicationStatus =
  | 'applied' | 'under_review' | 'shortlisted' | 'interview' | 'task' | 'accepted' | 'rejected' | 'withdrawn'

export interface Option {
  id: string
  label: string
}

export interface Role {
  id: RoleId
  title: string
  duty: string
}

export interface Department {
  id: DepartmentId
  title: string
  summary: string
  roles: Role[]
}

export type QuestionKind = 'text' | 'longtext' | 'choice' | 'choices' | 'links'

export interface Question {
  id: string
  kind: QuestionKind
  label: string
  hint?: string
  placeholder?: string
  options?: Option[]
  required: boolean
  /** Longest text the database keeps. */
  max?: number
  /** For `choices`: the option that rules out the others («Пока нет опыта»). */
  exclusive?: string
  /** For `choices` with «Другое»: a line to say what. */
  other?: { id: string; label: string; max: number }
}

/** The dates of the round, as the page and the confirmation say them. The database holds the
 * moments the form opens and closes (private.settings, changed in the Hub). */
export const ROUND = {
  applications: '9–16 ноября',
  interviews: '17–23 ноября',
  next: 'подготовка AIT Week',
  year: 2026,
}

/** The date of the terms on aitclub.org/privacy the applicant agrees to. A new text, a new date. */
export const CONSENT_VERSION = '2026-11-09'

export const DEPARTMENTS: Department[] = [
  {
    id: 'education',
    title: 'Education',
    summary: 'Два полноценных преподавателя на каждое направление: ведут занятия и отвечают за то, чему учит клуб.',
    roles: [
      { id: 'lead_mentor', title: 'Lead Mentor', duty: 'Отвечает за содержание направления и проводит занятия.' },
      { id: 'co_mentor', title: 'Co-Mentor', duty: 'Совместно ведёт занятия, чередуется с другим ментором и может его заменять.' },
    ],
  },
  {
    id: 'pr',
    title: 'PR & Creative',
    summary: 'Голос и лицо клуба: публичные каналы, визуальный стиль, видео и тексты.',
    roles: [
      { id: 'smm', title: 'PR / SMM Manager', duty: 'Instagram, Telegram, контент-план.' },
      { id: 'designer', title: 'Graphic Designer', duty: 'Постеры, карусели, визуальный стиль.' },
      { id: 'video', title: 'Video Editor / Motion Designer', duty: 'Reels, монтаж, проморолики.' },
      { id: 'copywriter', title: 'Copywriter', duty: 'Тексты, анонсы, интервью.' },
      { id: 'community', title: 'Community Manager', duty: 'Сообщения, комментарии, взаимодействие с аудиторией.' },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    summary: 'Всё, на чём держится клуб: процессы, мероприятия, люди и партнёры.',
    roles: [
      { id: 'operations_manager', title: 'Operations Manager', duty: 'Процессы, расписания, контроль сроков.' },
      { id: 'event_manager', title: 'Event Manager', duty: 'Мероприятия, AIT Week, спикеры.' },
      { id: 'hr', title: 'Recruitment / HR Manager', duty: 'Отбор и адаптация команды.' },
      { id: 'partnerships', title: 'Partnership Manager', duty: 'SKO Hub, компании, университеты, партнёры.' },
      { id: 'ambassadors', title: 'School Ambassador Coordinator', duty: 'Представители клуба в разных НИШ.' },
    ],
  },
  {
    id: 'data',
    title: 'Data & Analytics',
    summary: 'Цифры, по которым клуб понимает, что работает: набор, посещаемость, мероприятия, результаты.',
    roles: [
      { id: 'data_manager', title: 'Data & Analytics Manager', duty: 'Статистика набора, посещаемости, мероприятий и образовательных результатов.' },
    ],
  },
]

export const ROLES: Role[] = DEPARTMENTS.flatMap((d) => d.roles)
export const department = (id: string | null | undefined) => DEPARTMENTS.find((d) => d.id === id)
export const role = (id: string | null | undefined) => ROLES.find((r) => r.id === id)
export const roleDepartment = (id: string | null | undefined) => DEPARTMENTS.find((d) => d.roles.some((r) => r.id === id))

/** The club's three directions, as Education asks about them. */
export const DIRECTIONS: Option[] = [
  { id: 'ai', label: 'Artificial Intelligence' },
  { id: 'algo', label: 'Algorithms & Olympiads' },
  { id: 'startup', label: 'Startup Engineering' },
]

export const APPLICANT_STATUSES: Option[] = [
  { id: 'nis_student', label: 'Ученик НИШ' },
  { id: 'nis_graduate', label: 'Выпускник НИШ' },
  { id: 'university', label: 'Студент' },
  { id: 'other', label: 'Другое' },
]

/** Nazarbayev Intellectual Schools by city. A school that isn't here: «Другая НИШ». */
export const NIS_CITIES = [
  'Актау', 'Актобе', 'Алматы', 'Астана', 'Атырау', 'Караганда', 'Кокшетау', 'Костанай', 'Кызылорда',
  'Павлодар', 'Петропавловск', 'Семей', 'Талдыкорган', 'Тараз', 'Туркестан', 'Уральск', 'Усть-Каменогорск', 'Шымкент',
]
export const nisSchool = (city: string) => `НИШ, ${city}`

/** What «Класс / курс» offers for each status. `null`: a line of text. */
export function gradeOptions(status: string): Option[] | null {
  if (status === 'nis_student') return [7, 8, 9, 10, 11, 12].map((n) => ({ id: `${n} класс`, label: `${n} класс` }))
  if (status === 'nis_graduate') {
    return [...[2026, 2025, 2024, 2023].map((y) => ({ id: `Выпуск ${y}`, label: `Выпуск ${y}` })), { id: 'Выпуск до 2023', label: 'Раньше' }]
  }
  if (status === 'university') return [1, 2, 3, 4, 5, 6].map((n) => ({ id: `${n} курс`, label: `${n} курс` }))
  return null
}

const o = (pairs: [string, string][]): Option[] => pairs.map(([id, label]) => ({ id, label }))

/** Step 3: the questions of each department. Ids are the keys of `answers` in the database. */
export const DEPARTMENT_QUESTIONS: Record<DepartmentId, Question[]> = {
  education: [
    { id: 'direction', kind: 'choice', label: 'Какое направление хочешь преподавать?', required: true, options: DIRECTIONS },
    {
      id: 'preferred', kind: 'choice', label: 'Предпочитаемая роль', required: true,
      hint: 'Lead и Co-Mentor — два полноценных преподавателя направления. Они сами договариваются, кто какие занятия ведёт.',
      options: o([['lead', 'Lead Mentor'], ['co', 'Co-Mentor'], ['both', 'Подойдёт любая']]),
    },
    {
      id: 'skills', kind: 'longtext', label: 'Какими темами и технологиями владеешь?', required: true, max: 1500,
      placeholder: 'Например: Python, поиск и минимакс, основы ML; C++, графы, ДП; React, интервью с пользователями',
    },
    {
      id: 'achievements', kind: 'longtext', label: 'Опыт и достижения', required: true, max: 1500,
      hint: 'Проекты, олимпиады, соревнования, опыт преподавания.',
    },
    {
      id: 'links', kind: 'links', label: 'Ссылки на GitHub, Codeforces или портфолио', required: false,
      hint: 'Необязательно. До трёх ссылок.',
    },
    {
      id: 'explain', kind: 'longtext', label: 'Как ты объяснишь сложную тему человеку без опыта?', required: true, max: 1000,
      hint: 'Коротко: можно на примере одной темы.',
    },
    {
      id: 'tasks', kind: 'choices', label: 'Что хочешь делать?', required: true,
      options: o([['theory', 'Теоретические занятия'], ['practice', 'Практикумы'], ['review', 'Проверка заданий'],
        ['materials', 'Подготовка материалов'], ['co_teaching', 'Совместное преподавание'],
        ['substitute', 'Замена другого ментора по договорённости']]),
    },
    {
      id: 'solo_lesson', kind: 'choice', label: 'Сможешь самостоятельно провести онлайн-занятие?', required: true,
      options: o([['yes', 'Да'], ['after_prep', 'После подготовки'], ['not_yet', 'Пока нет']]),
    },
    {
      id: 'substitute', kind: 'choice', label: 'Сможешь подменять второго ментора?', required: true,
      options: o([['yes', 'Да'], ['sometimes', 'Иногда'], ['no', 'Нет']]),
    },
  ],
  pr: [
    {
      id: 'tools', kind: 'choices', label: 'Какими инструментами владеешь?', required: true,
      options: o([['figma', 'Figma'], ['canva', 'Canva'], ['adobe', 'Photoshop / Illustrator'], ['capcut', 'CapCut'],
        ['premiere', 'Premiere Pro / After Effects'], ['instagram', 'Instagram'], ['telegram', 'Telegram'], ['other', 'Другое']]),
      other: { id: 'tools_other', label: 'Что ещё?', max: 120 },
    },
    {
      id: 'tasks', kind: 'choices', label: 'Какие задачи хочешь выполнять?', required: true,
      options: o([['smm', 'Ведение Instagram / Telegram'], ['content_plan', 'Контент-план'], ['posters', 'Постеры и карусели'],
        ['reels', 'Reels / видео'], ['texts', 'Написание текстов'], ['interviews', 'Интервью'],
        ['community', 'Работа с подписчиками'], ['analytics', 'Аналитика публикаций']]),
    },
    {
      id: 'links', kind: 'links', label: 'Портфолио или примеры работ', required: false,
      hint: 'Необязательно. До трёх ссылок: Behance, Google Drive, Instagram, YouTube.',
    },
    {
      id: 'idea', kind: 'longtext', label: 'Предложи одну идею, как привлечь школьников в AIT Club', required: true, max: 1500,
    },
    {
      id: 'style', kind: 'choice', label: 'Как тебе удобнее работать?', required: true,
      options: o([['own', 'Самостоятельно, со своей зоной ответственности'], ['team', 'В команде'], ['both', 'Подходит и так, и так']]),
    },
    {
      id: 'after_week', kind: 'choice', label: 'Сможешь регулярно работать над публичными каналами клуба после AIT Week?', required: true,
      options: o([['yes', 'Да'], ['limited', 'С ограниченной нагрузкой'], ['projects', 'Только отдельные проекты']]),
    },
  ],
  operations: [
    {
      id: 'tasks', kind: 'choices', label: 'Какие задачи интересны?', required: true,
      options: o([['events', 'Организация мероприятий'], ['schedules', 'Расписания и контроль задач'], ['interviews', 'Собеседования'],
        ['candidates', 'Работа с кандидатами'], ['speakers', 'Поиск спикеров'], ['partners', 'Партнёрства'],
        ['schools', 'Коммуникация со школами'], ['documents', 'Реестры и документы']]),
    },
    {
      id: 'org_experience', kind: 'longtext', label: 'Опыт организации проектов или мероприятий', required: false, max: 1500,
      hint: 'Необязательно.',
    },
    {
      id: 'case', kind: 'longtext', label: 'Приглашённый спикер отменил участие за день до мероприятия. Что ты сделаешь?', required: true, max: 1500,
    },
    { id: 'tracking', kind: 'longtext', label: 'Как ты отслеживаешь задачи и дедлайны?', required: true, max: 1000 },
    {
      id: 'outreach', kind: 'choice', label: 'Комфортно ли тебе связываться с незнакомыми людьми от имени клуба?', required: true,
      options: o([['yes', 'Да'], ['with_guidance', 'С инструкциями'], ['internal', 'Предпочитаю внутренние задачи']]),
    },
  ],
  data: [
    {
      id: 'tools', kind: 'choices', label: 'Какие инструменты знаешь?', required: true, exclusive: 'none',
      options: o([['sheets', 'Google Sheets'], ['excel', 'Excel'], ['python', 'Python / pandas'], ['sql', 'SQL'],
        ['bi', 'Looker Studio / BI'], ['other', 'Другое'], ['none', 'Пока нет опыта']]),
      other: { id: 'tools_other', label: 'Что ещё?', max: 120 },
    },
    {
      id: 'interests', kind: 'choices', label: 'Что интересно анализировать?', required: true,
      options: o([['registrations', 'Регистрации'], ['attendance', 'Посещаемость'], ['assignments', 'Выполнение заданий'],
        ['activity', 'Активность участников'], ['ait_week', 'Результаты AIT Week'], ['social', 'Instagram / Telegram'],
        ['dashboards', 'Дашборды']]),
    },
    { id: 'data_experience', kind: 'longtext', label: 'Опыт работы с данными', required: false, max: 1500, hint: 'Необязательно.' },
    { id: 'metrics', kind: 'longtext', label: 'Какие три показателя покажут, что AIT Week прошла успешно?', required: true, max: 1000 },
    {
      id: 'reports', kind: 'choice', label: 'Сможешь готовить регулярные отчёты?', required: true,
      options: o([['yes', 'Да'], ['schedule', 'По согласованному графику'], ['oneoff', 'Только разовые задачи']]),
    },
    { id: 'privacy', kind: 'longtext', label: 'Как обеспечить конфиденциальность данных участников?', required: true, max: 1000, hint: 'Коротко.' },
  ],
}

/** Step 4: for everyone, whatever the department. */
export const AVAILABILITY_QUESTIONS: Question[] = [
  {
    id: 'hours', kind: 'choice', label: 'Сколько часов в неделю можешь выделять?', required: true,
    options: o([['lt2', 'До 2'], ['2_4', '2–4'], ['4_6', '4–6'], ['6_8', '6–8'], ['gt8', 'Более 8']]),
  },
  {
    id: 'work_times', kind: 'choices', label: 'Когда удобнее работать?', required: true,
    options: o([['after_school', 'Будни после занятий'], ['evening', 'Будни вечером'], ['saturday', 'Суббота'],
      ['sunday', 'Воскресенье'], ['flexible', 'По договорённости']]),
  },
  {
    id: 'interview', kind: 'choice', label: `Сможешь пройти онлайн-собеседование ${ROUND.interviews}?`, required: true,
    options: o([['yes', 'Да'], ['coordinate', 'Нужно согласовать время']]),
  },
  {
    id: 'term', kind: 'choice', label: 'На какой срок хочешь присоединиться?', required: true,
    options: o([['long', 'Долгосрочно'], ['launch', 'Только запуск / AIT Week'], ['undecided', 'Пока не знаю']]),
  },
  {
    id: 'other_role', kind: 'choice', label: 'Рассмотришь другую роль?', required: true,
    options: o([['yes', 'Да'], ['maybe', 'Возможно'], ['no', 'Нет']]),
  },
  { id: 'motivation', kind: 'longtext', label: 'Почему хочешь присоединиться к AIT Club?', required: true, max: 2000 },
  { id: 'extra_info', kind: 'longtext', label: 'Дополнительная информация', required: false, max: 2000, hint: 'Необязательно.' },
]

/** Where an application is in the selection, in the order it moves. */
export const APPLICATION_STATUSES: { id: ApplicationStatus; label: string; final?: boolean }[] = [
  { id: 'applied', label: 'Подана' },
  { id: 'under_review', label: 'На рассмотрении' },
  { id: 'shortlisted', label: 'Шорт-лист' },
  { id: 'interview', label: 'Собеседование' },
  { id: 'task', label: 'Задание' },
  { id: 'accepted', label: 'Принята', final: true },
  { id: 'rejected', label: 'Отказ', final: true },
  { id: 'withdrawn', label: 'Отозвана', final: true },
]

// ── The form's values ────────────────────────────────────────────────────────

export interface ApplicationForm {
  full_name: string
  applicant_status: ApplicantStatus | ''
  /** NIS by city, `other` for «Другая НИШ»; only for NIS pupils and graduates. */
  nis_city: string
  /** The school or university and city, typed (everyone but NIS by city). */
  school_other: string
  grade: string
  email: string
  telegram: string
  experience: string
  department: DepartmentId | ''
  role: RoleId | ''
  extra_role: RoleId | ''
  /** Department questions and step 4: text, an option id, or a list of option ids / links. */
  answers: Record<string, string | string[]>
  volunteer_ack: boolean
  consent: boolean
  is_adult: boolean | null
  guardian_consent: boolean
}

export const emptyForm = (): ApplicationForm => ({
  full_name: '', applicant_status: '', nis_city: '', school_other: '', grade: '', email: '', telegram: '', experience: '',
  department: '', role: '', extra_role: '', answers: {}, volunteer_ack: false, consent: false, is_adult: null, guardian_consent: false,
})

export const isNis = (status: string) => status === 'nis_student' || status === 'nis_graduate'

export function schoolOf(form: ApplicationForm): string {
  if (isNis(form.applicant_status) && form.nis_city && form.nis_city !== 'other') return nisSchool(form.nis_city)
  return form.school_other.trim()
}

// ── Checks (the database repeats them) ───────────────────────────────────────

export const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/
export const TELEGRAM = /^[A-Za-z0-9_]{5,32}$/
export const LINK = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:[0-9]{1,5})?([/?#]\S*)?$/i

/** «@name», «t.me/name» or «name» → «name». */
export const normalizeTelegram = (value: string) =>
  value.trim().replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, '').replace(/^@+/, '')

/** «github.com/x» → «https://github.com/x». */
export const normalizeLink = (value: string) => {
  const v = value.trim()
  return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? `https://${v}` : v
}

export type Errors = Record<string, string>

const len = (value: string) => [...value.trim()].length

function checkQuestion(q: Question, value: string | string[] | undefined, answers: Record<string, string | string[]>, errors: Errors) {
  if (q.kind === 'choices') {
    const list = Array.isArray(value) ? value : []
    if (q.required && list.length === 0) errors[q.id] = 'Выбери хотя бы один вариант'
    else if (q.exclusive && list.includes(q.exclusive) && list.length > 1) errors[q.id] = 'Этот вариант не сочетается с остальными'
    const other = q.other ? String(answers[q.other.id] ?? '') : ''
    if (q.other && list.includes('other') && len(other) > q.other.max) errors[q.other.id] = `Не больше ${q.other.max} символов`
    return
  }
  if (q.kind === 'links') {
    const list = (Array.isArray(value) ? value : []).map((v) => v.trim()).filter(Boolean)
    if (list.length > 3) errors[q.id] = 'Не больше трёх ссылок'
    else if (list.some((v) => v.length > 300 || !LINK.test(normalizeLink(v)))) errors[q.id] = 'Проверь ссылку: например, https://github.com/username'
    return
  }
  const text = typeof value === 'string' ? value : ''
  if (q.kind === 'choice') {
    if (q.required && !text) errors[q.id] = 'Выбери вариант'
    return
  }
  if (q.required && !text.trim()) errors[q.id] = 'Напиши ответ'
  else if (q.max && len(text) > q.max) errors[q.id] = `Не больше ${q.max} символов, сейчас ${len(text)}`
}

/** The steps of the form, in order: Personal Info → Role → Role Questions → Availability → Review. */
export const STEPS = [
  { id: 'personal', title: 'Personal Info', label: 'О тебе' },
  { id: 'role', title: 'Role', label: 'Роль' },
  { id: 'questions', title: 'Role Questions', label: 'Вопросы роли' },
  { id: 'availability', title: 'Availability', label: 'Время' },
  { id: 'review', title: 'Review', label: 'Проверка' },
] as const

export function validateStep(step: number, form: ApplicationForm): Errors {
  const errors: Errors = {}
  if (step === 0) {
    const name = form.full_name.trim()
    if (!name) errors.full_name = 'Напиши имя и фамилию'
    else if (len(name) < 2 || len(name) > 120) errors.full_name = 'От 2 до 120 символов'
    if (!form.applicant_status) errors.applicant_status = 'Выбери вариант'
    if (isNis(form.applicant_status) && !form.nis_city) errors.nis_city = 'Выбери школу'
    else if (form.applicant_status && !(isNis(form.applicant_status) && form.nis_city !== 'other')) {
      const school = form.school_other.trim()
      if (len(school) < 2) errors.school_other = 'Напиши школу или университет и город'
      else if (len(school) > 160) errors.school_other = 'Не больше 160 символов'
    }
    if (form.applicant_status && !form.grade.trim()) errors.grade = gradeOptions(form.applicant_status) ? 'Выбери вариант' : 'Напиши класс, курс или чем занимаешься'
    else if (len(form.grade) > 40) errors.grade = 'Не больше 40 символов'
    const email = form.email.trim().toLowerCase()
    if (!email) errors.email = 'Напиши почту: по ней мы свяжемся с тобой'
    else if (email.length > 254 || !EMAIL.test(email)) errors.email = 'Проверь адрес: например, name@mail.kz'
    const telegram = normalizeTelegram(form.telegram)
    if (telegram && !TELEGRAM.test(telegram)) errors.telegram = 'От 5 до 32 латинских букв, цифр или _'
    if (len(form.experience) > 1500) errors.experience = `Не больше 1500 символов, сейчас ${len(form.experience)}`
  } else if (step === 1) {
    const dept = department(form.department)
    if (!dept) errors.department = 'Выбери департамент'
    else if (!dept.roles.some((r) => r.id === form.role)) errors.role = 'Выбери роль'
    if (form.extra_role && form.extra_role === form.role) errors.extra_role = 'Дополнительная роль должна отличаться от основной'
  } else if (step === 2) {
    const dept = department(form.department)
    if (!dept) errors.department = 'Выбери департамент'
    else for (const q of DEPARTMENT_QUESTIONS[dept.id]) checkQuestion(q, form.answers[q.id], form.answers, errors)
  } else if (step === 3) {
    for (const q of AVAILABILITY_QUESTIONS) checkQuestion(q, form.answers[q.id], form.answers, errors)
  } else if (step === 4) {
    if (!form.volunteer_ack) errors.volunteer_ack = 'Отметь, чтобы отправить заявку'
    if (!form.consent) errors.consent = 'Без согласия мы не можем принять заявку'
    if (form.is_adult === null) errors.is_adult = 'Выбери вариант'
    else if (!form.is_adult && !form.guardian_consent) errors.guardian_consent = 'Нужно согласие родителя или законного представителя'
  }
  return errors
}

/** Which step holds a field the database refused (`invalid_form`, field). */
export function stepOfField(field: string, dept: string): number {
  if (['full_name', 'applicant_status', 'school', 'nis_city', 'school_other', 'grade', 'email', 'telegram', 'experience'].includes(field)) return 0
  if (['department', 'role', 'extra_role'].includes(field)) return 1
  if (AVAILABILITY_QUESTIONS.some((q) => q.id === field)) return 3
  const questions = DEPARTMENT_QUESTIONS[dept as DepartmentId] ?? []
  if (questions.some((q) => q.id === field || q.other?.id === field) || field === 'answers') return 2
  return 4
}

/** What goes to the database: only the chosen department's answers, links and handles tidied up. */
export function buildPayload(form: ApplicationForm) {
  const dept = form.department as DepartmentId
  const pick = (questions: Question[]) => {
    const out: Record<string, string | string[] | null> = {}
    for (const q of questions) {
      const v = form.answers[q.id]
      if (q.kind === 'links') out[q.id] = (Array.isArray(v) ? v : []).map((x) => normalizeLink(x)).filter(Boolean)
      else if (q.kind === 'choices') out[q.id] = Array.isArray(v) ? v : []
      else out[q.id] = typeof v === 'string' && v.trim() ? v : null
      if (q.other) out[q.other.id] = Array.isArray(v) && v.includes('other') ? String(form.answers[q.other.id] ?? '') || null : null
    }
    return out
  }
  const availability = pick(AVAILABILITY_QUESTIONS)
  return {
    full_name: form.full_name,
    applicant_status: form.applicant_status,
    school: schoolOf(form),
    grade: form.grade,
    email: form.email.trim().toLowerCase(),
    telegram: normalizeTelegram(form.telegram) || null,
    experience: form.experience.trim() || null,
    department: dept,
    role: form.role,
    extra_role: form.extra_role || null,
    answers: pick(DEPARTMENT_QUESTIONS[dept] ?? []),
    ...availability,
    volunteer_ack: form.volunteer_ack,
    consent: form.consent,
    consent_version: CONSENT_VERSION,
    is_adult: form.is_adult === true,
    guardian_consent: form.is_adult === false && form.guardian_consent,
  }
}

// ── Showing answers ──────────────────────────────────────────────────────────

const optionLabel = (q: Question, id: string) => q.options?.find((x) => x.id === id)?.label ?? id

/** An answer in words: option labels instead of ids, lists joined. */
export function answerText(q: Question, value: unknown, answers: Record<string, unknown> = {}): string {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value)) {
    if (q.kind === 'links') return value.join('\n')
    const words = value.map((id) => (id === 'other' && q.other && answers[q.other.id] ? `${optionLabel(q, id)}: ${answers[q.other.id]}` : optionLabel(q, String(id))))
    return words.join(', ')
  }
  if (q.kind === 'choice') return optionLabel(q, String(value))
  return String(value)
}

/** The contact for questions and for withdrawing consent: a Telegram handle (@name), an email or
 * an https address. `null`: not one of those. */
export function contactHref(contact: string): string | null {
  const c = contact.trim()
  if (/^@[A-Za-z0-9_]{5,32}$/.test(c)) return `https://t.me/${c.slice(1)}`
  if (/^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(c)) return `mailto:${c}`
  if (/^https:\/\/\S+$/.test(c)) return c
  return null
}

export const statusLabel = (id: string) => APPLICATION_STATUSES.find((s) => s.id === id)?.label ?? id
export const applicantStatusLabel = (id: string) => APPLICANT_STATUSES.find((s) => s.id === id)?.label ?? id
