function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function enabled(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

const DEFAULT_ADMIN_EMAILS = ['info.codeemy@gmail.com'];

/**
 * Returns the server-managed allowlist. This must never be exposed through a
 * NEXT_PUBLIC_ environment variable.
 */
export function configuredAdminEmails(environment = process.env) {
  const fromEnv = String(environment.LMS_ADMIN_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  return [...new Set([...DEFAULT_ADMIN_EMAILS, ...fromEnv])];
}

export function isConfiguredAdminEmail(email, environment = process.env) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && configuredAdminEmails(environment).includes(normalized);
}

/**
 * ADMIN access requires all three controls: server allowlist, verified Firebase
 * identity, and an ADMIN row in PostgreSQL. Returning a string keeps API error
 * messages safe while avoiding disclosure of credentials or internal IDs.
 */
export function adminIdentityIssue(token, actor, environment = process.env) {
  const configured = configuredAdminEmails(environment);
  if (!configured.length)
    return 'Administrator sign-in is not configured. Contact your system administrator.';

  const accountEmail = normalizeEmail(actor?.email);
  const verifiedEmail = normalizeEmail(token?.email);

  if (!isConfiguredAdminEmail(accountEmail, environment))
    return 'This administrator account is not authorized by server configuration.';

  if (!verifiedEmail || verifiedEmail !== accountEmail)
    return 'The verified Firebase email does not match this administrator account.';

  if (enabled(environment.LMS_REQUIRE_VERIFIED_ADMIN_EMAIL) && token?.email_verified !== true)
    return 'Administrator access requires a verified Firebase email address.';

  if (
    enabled(environment.LMS_REQUIRE_GOOGLE_ADMIN_PROVIDER) &&
    token?.firebase?.sign_in_provider !== 'google.com'
  )
    return 'Administrator access requires the approved Google sign-in identity.';

  return null;
}
