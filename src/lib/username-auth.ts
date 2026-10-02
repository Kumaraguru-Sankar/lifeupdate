// Username-only auth: we synthesize an internal email so Supabase Auth is happy.
// The user never sees this email — they log in with just username + password.

const DOMAIN = "users.lifeupdate.app";

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${DOMAIN}`;
}

export function isUsernameValid(username: string) {
  const u = normalizeUsername(username);
  return u.length >= 3 && u.length <= 24 && /^[a-z0-9][a-z0-9_.-]*$/.test(u);
}
