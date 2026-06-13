// HMAC-SHA256 over `${timestamp}.${body}`, shared between this relay and the n8n
// verify node. Hex-encoded. Web Crypto only (no Node/Deno std imports) so the exact
// same code can run in the Supabase Edge runtime and in an n8n Code node.

const encoder = new TextEncoder()

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** Hex HMAC-SHA256 of `message` keyed with `secret`. */
export async function sign(message: string, secret: string): Promise<string> {
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time compare of a candidate hex signature against the expected one. */
export async function verify(
  message: string,
  secret: string,
  candidateHex: string,
): Promise<boolean> {
  const expected = await sign(message, secret)
  if (expected.length !== candidateHex.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ candidateHex.charCodeAt(i)
  }
  return diff === 0
}
