// Turns on what GitHub offers a public repository for free and locks the main branch. Without
// --apply it prints the plan; with it, it uses your `gh` login. Safe to run again.
//
//   npm run security:github
//   npm run security:github -- --apply
//
// Run it after the pinned workflows are on main: it makes pinning mandatory.

import { execFileSync } from 'node:child_process'

const REPO = 'knbww/ait-hub'
const BACKUPS = 'knbww/ait-hub-backups'
const RULESET = 'main protection'
const apply = process.argv.includes('--apply')

function gh(method, path, body) {
  return execFileSync('gh', ['api', '-X', method, path, ...(body ? ['--input', '-'] : [])], {
    encoding: 'utf8',
    input: body ? JSON.stringify(body) : undefined,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

let failed = 0
function step(what, method, path, body, { optional = false } = {}) {
  if (!apply) return console.log(`  will  ${what}`)
  try {
    gh(method, path, body)
    console.log(`  done  ${what}`)
  } catch (e) {
    const reason = String(e.stderr ?? e.message).split('\n').find(Boolean)
    if (optional) return console.log(`  skip  ${what} (${reason})`)
    failed++
    console.log(`  FAIL  ${what}: ${reason}`)
  }
}

const me = JSON.parse(gh('GET', 'user'))
console.log(`${apply ? 'Applying' : 'Plan only: nothing changes without --apply'} (signed in as ${me.login})`)

console.log('\nFinding problems early')
step('Dependabot alerts', 'PUT', `repos/${REPO}/vulnerability-alerts`)
step('Dependabot security updates', 'PUT', `repos/${REPO}/automated-security-fixes`)
step('private vulnerability reporting (the address in security.txt)', 'PUT', `repos/${REPO}/private-vulnerability-reporting`)
step('secret scanning: generic patterns and validity checks', 'PATCH', `repos/${REPO}`, {
  security_and_analysis: {
    secret_scanning_non_provider_patterns: { status: 'enabled' },
    secret_scanning_validity_checks: { status: 'enabled' },
  },
}, { optional: true })

console.log('\nThe repository')
step('no wiki (an open place to write on a project page), merged branches go away', 'PATCH', `repos/${REPO}`, {
  has_wiki: false,
  delete_branch_on_merge: true,
})

console.log('\nGitHub Actions')
step('only GitHub\'s own actions, pinned to a commit', 'PUT', `repos/${REPO}/actions/permissions`, {
  enabled: true, allowed_actions: 'selected', sha_pinning_required: true,
})
step('list of allowed actions', 'PUT', `repos/${REPO}/actions/permissions/selected-actions`, {
  github_owned_allowed: true, verified_allowed: false, patterns_allowed: [],
})
step('workflows read-only by default, cannot approve pull requests', 'PUT', `repos/${REPO}/actions/permissions/workflow`, {
  default_workflow_permissions: 'read', can_approve_pull_request_reviews: false,
})
step('a pull request from outside waits for your approval before any code runs', 'PUT',
  `repos/${REPO}/actions/permissions/fork-pr-contributor-approval`, { approval_policy: 'all_external_contributors' }, { optional: true })
step('backups: only GitHub\'s actions and the Supabase CLI', 'PUT', `repos/${BACKUPS}/actions/permissions`, {
  enabled: true, allowed_actions: 'selected',
})
step('backups: list of allowed actions', 'PUT', `repos/${BACKUPS}/actions/permissions/selected-actions`, {
  github_owned_allowed: true, verified_allowed: false, patterns_allowed: ['supabase/setup-cli@*'],
})

console.log('\nPublishing')
// An approval only makes sense once CI holds the deploy token: until then every push to main would
// leave two deploy jobs waiting for nobody.
let ciPublishes = false
try {
  ciPublishes = JSON.parse(gh('GET', `repos/${REPO}/environments/production/secrets`)).total_count > 0
} catch {
  // No environment yet: publishing happens from a computer.
}
step(ciPublishes
  ? `environment production: only main, and each deployment waits for ${me.login}`
  : 'environment production: only main (no approval while you publish from your computer; run again after moving the token to CI)',
'PUT', `repos/${REPO}/environments/production`, {
  wait_timer: 0,
  prevent_self_review: false,
  reviewers: ciPublishes ? [{ type: 'User', id: me.id }] : [],
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
})
step('environment production: its secrets reach only main', 'POST', `repos/${REPO}/environments/production/deployment-branch-policies`,
  { name: 'main', type: 'branch' }, { optional: true })

console.log('\nThe main branch')
const ruleset = {
  name: RULESET,
  target: 'branch',
  enforcement: 'active',
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  rules: [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
      },
    },
    {
      type: 'required_status_checks',
      parameters: { strict_required_status_checks_policy: false, required_status_checks: [{ context: 'verify' }] },
    },
  ],
}
const existing = JSON.parse(gh('GET', `repos/${REPO}/rulesets`)).find((r) => r.name === RULESET)
step('no force pushes or deletion; changes come through a pull request with green CI',
  existing ? 'PUT' : 'POST', `repos/${REPO}/rulesets${existing ? `/${existing.id}` : ''}`, ruleset)

console.log(apply ? `\n${failed ? `${failed} failed` : 'Done'}` : '\nRun again with --apply when the list looks right.')
process.exitCode = failed ? 1 : 0
