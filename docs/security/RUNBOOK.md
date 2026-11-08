# Безопасность: выкатка и эксплуатация

Шаги идут по порядку: многие зависят от предыдущих. Команды выполняются из корня репозитория.

## 1. Аккаунты (до всего остального)

Взлом любого из этих аккаунтов обходит всю защиту в коде.

1. Включите двухфакторный вход (приложение или ключ, не SMS) и сохраните коды восстановления:
   **GitHub**, **Cloudflare**, **Supabase**, **Namecheap**, **Google** (почта, на которую всё это
   зарегистрировано).
2. Namecheap → Domain List → aitclub.org: включите **Domain Lock**.
3. Каждый сотрудник Hub (директор, куратор, руководители) включает двухфакторный вход: Профиль →
   Двухфакторный вход. **Директор и куратор обязаны сделать это до слияния на шаге 3**, иначе после
   миграции у них закроются данные участников. Войти и включить фактор они смогут и потом, но лучше
   заранее: пока фактора нет, тот, кто узнал пароль, может привязать к аккаунту своё приложение.

## 2. Cloudflare

1. Создайте временный токен: [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
   → Create Token → Create Custom Token.
   - Права: `Zone · Zone · Read`, `Zone · Zone Settings · Edit`, `Zone · DNS · Edit`,
     `Zone · Zone WAF · Edit`, `Account · Turnstile · Edit`.
   - Zone Resources: Include · Specific zone · aitclub.org.
   - TTL: сегодняшний день.
2. Запустите. Токен вводится скрыто и не попадает в историю команд:
   ```bash
   read -rs CF_ZONE_TOKEN && export CF_ZONE_TOKEN
   npm run security:cloudflare                # покажет план, ничего не меняет
   npm run security:cloudflare -- --apply     # применит
   ```
   Если кто-то отправляет письма с адресов @aitclub.org (сейчас в DNS нет ни одной службы отправки),
   добавьте `--dmarc=none`, иначе такие письма начнут отклоняться.
3. **Сохраните** Site key и Secret из вывода. Secret показывается один раз.
4. Скрипт напечатает данные DS. Namecheap → Domain List → aitclub.org → Manage → Advanced DNS →
   DNSSEC → включите и добавьте Key Tag, Algorithm, Digest Type, Digest. Без этого шага DNSSEC не
   заработает.
5. Удалите временный токен на той же странице Cloudflare. `unset CF_ZONE_TOKEN`.

Bot Fight Mode не включаем осознанно: его нельзя отключить для отдельных путей, он внедряет скрипты
рядом со строгой CSP и может блокировать школьные сети, а защищал бы только статические файлы.

## 3. Выкатка кода

1. Влейте изменения в `main` через pull request. К репозиторию подключена интеграция Supabase: если в
   ней включена выкатка в прод, миграция применится сама в момент слияния. Поэтому шаг 1 идёт раньше.
2. Заберите `main` и впишите в `.env.local`: `VITE_TURNSTILE_SITE_KEY=<Site key из шага 2>`.
   ```bash
   git switch main
   git pull
   npm ci
   ```
3. База. Если проект ещё не привязан, сначала `npx supabase link --project-ref gdzbicfulgsawkegpbpx`.
   ```bash
   npm run db:push
   ```
   Ответ, что база уже актуальна, значит, что миграцию применила интеграция. Это нормально.
4. Функция уведомлений (после базы: ей нужна новая таблица):
   ```bash
   npx supabase functions deploy push --project-ref gdzbicfulgsawkegpbpx
   ```
5. Сайты:
   ```bash
   npm run deploy
   npm run deploy:site
   ```
6. Откройте https://hub.aitclub.org/login: должен быть виджет Turnstile. Войдите, проверьте чат и новости.

## 4. Настройки Supabase

В этом порядке: капчу включайте только после шага 3, иначе вход перестанет работать.

1. **Authentication → Attack Protection:** Enable CAPTCHA protection, провайдер Turnstile,
   Secret key из шага 2. Сразу проверьте вход на сайте.
2. **Authentication → Sign In / Providers → Email:** Minimum password length — `10`.
3. **Authentication → URL Configuration:** Site URL — `https://hub.aitclub.org`. В Redirect URLs
   оставьте только `https://hub.aitclub.org/**`.
4. **Realtime → Settings:** выключите **Allow public access**. Проверьте, что сообщения в чате
   приходят без перезагрузки страницы.
5. **Database → Settings:** включите **Enforce SSL on incoming connections**.
6. **Settings → API Keys:** убедитесь, что устаревшие ключи `anon` и `service_role` отключены.
7. **Settings → Data API:** в Exposed schemas только `public`.
8. **Project Settings → Integrations → GitHub:** выключите автоматическую выкатку в прод, если
   она включена, или удалите интеграцию. Предварительные ветки на бесплатном плане всё равно не
   работают, а это лишний путь от репозитория прямо в базу. Миграции применяются `npm run db:push`.

Лимит «Sign-ups and sign-ins» (Authentication → Rate Limits) считается по адресу, а школа выходит в
сеть с одного. Если на встрече вступает больше 25 человек сразу, на время встречи поднимите его.

## 5. GitHub

После шага 3, когда закреплённые по коммитам workflow уже в `main`:

```bash
npm run security:github                # покажет план
npm run security:github -- --apply     # применит
```

Прямой push в `main` после этого запрещён: только pull request с зелёным CI.

Публикация через CI (вместо этого компьютера). Создайте токен Cloudflare: шаблон Edit Cloudflare
Pages, только этот аккаунт, срок год. Затем, **начиная с ключа Turnstile**: сборка без него закроет вход
всем, пока Supabase требует капчу (CI такую сборку не опубликует):

```bash
gh variable set VITE_TURNSTILE_SITE_KEY --body '<Site key>'
gh secret set CLOUDFLARE_API_TOKEN --env production
gh secret set CLOUDFLARE_ACCOUNT_ID --env production
npm run security:github -- --apply
```

Повторный запуск скрипта включит подтверждение: каждая публикация будет ждать вашего «да» в GitHub.
Пока токена в CI нет, скрипт подтверждение не ставит, и задания `deploy` просто пропускаются.

## 6. Ключи

В истории git утечек нет, но `.env.local` был доступен на чтение всем пользователям этой системы.
Теперь это исправлено (`chmod 600`). Если на компьютере работает кто-то ещё, смените всё из этого раздела.

1. Старый токен Cloudflare бессрочный: удалите его, когда заработает новый из шага 5.
2. Пароль базы: Database → Settings → Reset database password. Обновите секрет `SUPABASE_DB_URL` в
   `knbww/ait-hub-backups`.
3. Уберите из `.env.local` в менеджер паролей всё, что не нужно в работе: `SUPABASE_DB_URL`,
   `BACKUP_PASSPHRASE`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `DEMO_DB_PASSWORD`, `DEMO_DB_URL`.
4. `knbww/ait-hub-backups`, файл `.github/workflows/backup.yml`: действия не закреплены, а версия
   CLI плавающая, причём рядом с паролем базы. Замените:
   ```yaml
   - uses: supabase/setup-cli@1dedf2c611547ede7232d26866dd3c56ab903bbb # v1.7.3
     with:
       version: 2.105.0
   ```
   и `actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4 # v5.0.0`.

Менять раз в год или сразу при подозрении: токен Cloudflare, пароль базы, `CRON_SECRET` (одновременно
в секретах функции `push` и в GitHub).

## 7. Проверка

```bash
npm run security:live     # должно закончиться словами All good
npm run security:prod     # миграции совпадают, у советников нет ошибок
```

Вставьте `scripts/security/prod-audit.sql` в Supabase → SQL Editor: запрос только читает, показывает
счётчики без имён. Колонка `want` говорит, что должно быть.

## 8. По желанию

- **HSTS preload.** Отправьте `aitclub.org` на [hstspreload.org](https://hstspreload.org). Браузеры
  будут открывать домен только по HTTPS ещё до первого запроса. Отменяется месяцами: делайте, если
  уверены, что все поддомены останутся на HTTPS.
- **Демо-копия.** `npm run demo -- --reset`: новая схема и вымышленные данные заново. Пароль демо
  публичный, поэтому копию стоит иногда сбрасывать: загруженное посетителями там не проверяется.
- **Вход через GitHub.** Если им никто не пользуется, выключите провайдера (Authentication →
  Providers): меньше способов войти, меньше поверхность атаки.
- **Уведомления Cloudflare.** Notifications → Add: Pages → Deployment. Письмо о каждой публикации
  заметит чужую выкладку.
- **Файлы.** Бэкап содержит базу, но не файлы из Storage. Работы участников живут только в Supabase.

## Новый сотрудник

Приглашение действует трое суток. При повторном запуске обновите и дату:

```sql
insert into public.staff_invites (email, role, full_name, temp_password)
values ('<почта>', 'curator', '<Имя Фамилия>', '<временный пароль>')
on conflict (email) do update set role = excluded.role, full_name = excluded.full_name,
  temp_password = excluded.temp_password, created_at = now();
```

## Инциденты

**Украден телефон с кодами или потерян доступ к приложению.** SQL Editor:
```sql
delete from auth.mfa_factors where user_id = (select id from auth.users where email = '<почта>');
delete from auth.sessions where user_id = (select id from auth.users where email = '<почта>');
```
Убедитесь, что просит именно этот человек: это снимает второй фактор.

**Подозрение на взлом аккаунта участника или сотрудника.**
1. Страница участника → отключить аккаунт. Для директора и куратора: `update public.profiles set
   status = 'inactive' where user_id = ...` в SQL Editor.
2. Завершите сессии (запрос выше, вторая строка).
3. Посмотрите журнал: Управление → Журнал действий.
4. Выдайте код сброса, снова включите аккаунт.

**Утёк ключ или секрет.** Сначала отзовите, потом разбирайтесь.
- Токен Cloudflare: удалить на странице API Tokens.
- Секретный ключ Supabase: Settings → API Keys → создать новый, удалить старый.
- Пароль базы: Database → Settings → Reset, обновить секрет в репозитории бэкапов.
- `CRON_SECRET`: `npx supabase secrets set CRON_SECRET=... --project-ref gdzbicfulgsawkegpbpx` и `gh secret set CRON_SECRET`.
- Попавший в git секрет считайте раскрытым, даже если коммит удалён.

**Утечка данных участников.** Участники несовершеннолетние: сообщите директору и куратору сразу,
зафиксируйте, что и когда произошло, и не удаляйте журналы. Сообщить родителям и при необходимости
уполномоченному органу — решение руководства клуба.

**Атака на доступность.** Статические сайты защищает Cloudflare. Включите Under Attack Mode в
Security → Settings зоны. Для API: Supabase → Reports показывает нагрузку; при исчерпании лимитов
временно отключите регистрацию в Authentication.

**Нужно откатить миграцию.** Сделайте резервную копию и восстановите прежние определения функций и
политик из предыдущих миграций. Отключать RLS нельзя ни при каких обстоятельствах.
