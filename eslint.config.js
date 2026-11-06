import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  // `supabase/functions` is Deno (remote URL / npm: imports, `Deno` global) — not part of the
  // browser/Vite app and not type-checked by `tsc -b` (tsconfig.app includes only `src`). Linting
  // it with the Node/browser config would error on every import, so it's excluded here.
  globalIgnores(['dist', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // The Hub never turns strings into code or HTML, and Trusted Types would stop it in the
      // browser. Here it stops at review, where the fix is easy.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': ['error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Render text, not HTML: member data must not become markup.' },
        { selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML|insertAdjacentHTML)$/]', message: 'Use textContent or React: this turns a string into HTML.' },
        { selector: "MemberExpression[object.name='document'][property.name=/^(write|writeln)$/]", message: 'document.write turns a string into HTML.' },
      ],
    },
  },
])
