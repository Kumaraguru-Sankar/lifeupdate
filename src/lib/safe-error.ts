// Filters error messages before showing them to users via toasts.
// Server-side / framework internals (env var names, auth header details,
// stack traces, etc.) must never reach end users. Only allow messages that
// were intentionally authored as user-facing copy.

const INTERNAL_PATTERNS = [
  /supabase/i,
  /environment variable/i,
  /unauthorized/i,
  /authorization header/i,
  /bearer/i,
  /jwt/i,
  /token/i,
  /process\.env/i,
  /lovable cloud/i,
  /middleware/i,
  /\bclaims?\b/i,
];

export function safeErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!msg) return fallback;
  if (msg.length > 200) return fallback;
  if (INTERNAL_PATTERNS.some((re) => re.test(msg))) return fallback;
  return msg;
}
