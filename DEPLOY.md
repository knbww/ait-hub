# Deploying AIT Hub (Cloudflare Pages)

The frontend is a static Vite SPA. Cloudflare Pages builds it from GitHub on every
push and serves it on a global CDN with automatic HTTPS.

## One-time setup

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.**
   Authorize GitHub and pick `knbww/ait-hub`.

2. **Build settings:**
   | Setting | Value |
   |---|---|
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` |

   Node version is pinned to 22 via [.nvmrc](.nvmrc). If the build uses a different
   version, add an env var `NODE_VERSION=22`.

3. **Environment variables** (Settings → Environment variables — set for both
   **Production** and **Preview**):
   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://gdzbicfulgsawkegpbpx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your publishable key (`sb_publishable_…`) |
   | `VITE_SENTRY_DSN` | (optional) Sentry client DSN |

   These are public/client-safe by design. Do **not** add the service_role key.

4. **Supabase auth redirect URLs** (Supabase → Authentication → URL Configuration):
   add the Pages URLs so email-confirmation and OAuth redirects land back on the app:
   - Site URL: `https://ait-hub.pages.dev` (or your custom domain)
   - Additional redirect URLs: `https://*.ait-hub.pages.dev` (covers preview deploys)

## Environments

- **Production** = the `main` branch → your primary `*.pages.dev` URL (or custom domain).
- **Preview** = every other branch / PR gets its own preview URL automatically.

So `git push` to `main` ships production; PR branches get isolated preview deploys.

## SPA routing

[public/_redirects](public/_redirects) (`/* /index.html 200`) makes Pages serve
`index.html` for every path, so client-side routes like `/research` and `/admin`
work on refresh and deep links.

## Local production preview

```bash
npm run build && npm run preview
```
