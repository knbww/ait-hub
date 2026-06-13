// Shared CORS handling for browser-callable Edge Functions.
// The relay is also called server-side (DB webhook), where CORS is irrelevant, but the
// authenticated client path needs these headers.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Returns a preflight response for OPTIONS requests, or null to continue. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}
