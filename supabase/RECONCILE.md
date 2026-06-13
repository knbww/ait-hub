# Migration reconciliation (do this before the next `db push`)

Several migrations are written locally but not yet applied to the linked project, and two new
ones were just added (`application_screening_webhook`, `automation_errors`). Pushing blindly is
the risk flagged in Pillar 1 — reconcile first.

> None of these commands are run automatically. Run them yourself, reviewing each step's output.

## 1. See what's unapplied

```bash
supabase migration list          # Local vs Remote columns; un-applied files show local-only
```

Expected local-only (apply in this order — timestamps already sort correctly):

```
20260612150000_courses_catalog
20260612160000_challenges
20260612170000_avatars_storage
20260612180000_teams_help
20260613100000_application_screening_webhook
20260613110000_automation_errors
20260613120000_application_accept_webhook
20260613130000_ai_screening_detail
```

## 2. Check for drift the migrations don't capture

```bash
supabase db diff --linked --schema public        # empty = remote matches migrations
```

If this prints SQL, the remote was changed outside migrations (dashboard edits). Capture it as a
migration (`supabase db diff -f capture_remote_drift`) before pushing, or you'll lose it.

## 3. Dry-run, then push

```bash
supabase db push --dry-run       # prints the exact SQL that will run
supabase db push
```

## 4. After push

```bash
npm run db:types                 # regenerate src/lib/database.types.ts (then reconcile db-rows.ts)
supabase db start && npm run test:db   # pgTAP anti-cheat suite against the LOCAL db
```

## 5. Onboarding-automation wiring (one-time, see supabase/functions/README.md)

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_function_base');
select vault.create_secret('<same value as TRIGGER_INTERNAL_KEY>', 'trigger_internal_key');
```
