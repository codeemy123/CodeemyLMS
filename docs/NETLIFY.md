# Netlify deployment

The build command is `npm run build` and publish directory is `.next`; Node 24 is configured in netlify.toml. The build generates the ignored Prisma client before compiling Next.js. Never commit generated clients or local environment files to work around missing build output.

Bucket names and Firebase project IDs are public resource identifiers. Netlify's scan flags their ordinary occurrences in package names/docs if those variables are marked secret in the dashboard. netlify.toml excludes only CLOUDFLARE_R2_BUCKET_NAME and FIREBASE_PROJECT_ID from value matching. DATABASE_URL, R2 access/secret keys, Firebase private keys and other credentials remain scanned. Do not disable the scanner globally or exclude whole source/build directories.

## Middleware compatibility

Netlify's Next.js adapter packages Proxy/middleware in an Edge wrapper. Importing Firebase Admin, Prisma or `pg` into src/proxy.js breaks this bundling. Proxy now performs only the early missing-cookie/legacy-login redirects and forwards the canonical workspace section in an overwritten request header.

The shared workspace server layout verifies the actual Firebase session and active database role before rendering the workspace. Each role layout also enforces its fixed role, so request headers cannot authorize a different portal. These layouts run on Node. Every protected API separately verifies the actor and its resource scope; cookie presence is never treated as authentication.

Next.js can emit a meta redirect after streaming has started. Verification scripts check the actual redirect target, and browser tests confirm forged cookies land on /login while /api/auth/me rejects them with 401. Tests do not treat an arbitrary 200 response as a redirect.

## GCP backend routing

Production `/api/*` requests are force-proxied by netlify.toml to the CodeEmy Cloud Run service. Session cookies stay host-only on the public domain. `LMS_BACKEND_ORIGIN` is a public build setting; the Next.js workspace server layouts verify the cookie against Cloud Run `/api/auth/me` and enforce the returned role. They do not need Firebase Admin or database credentials on Netlify. Cloud Run permits only the exact LMS custom/Netlify origins for proxied writes, and continues to validate identity, status and permissions on every protected API.

Redeploy both the backend and Netlify after changing these settings. Do not set `LMS_BACKEND_ORIGIN` on Cloud Run itself. Existing Cloud SQL, Firebase Admin and R2 server credentials remain configured on GCP.

A successful build does not establish database/auth connectivity. Keep database, Firebase Admin and R2 credentials on GCP; Netlify uses the backend proxy rather than a localhost database, Cloud Run socket or local ADC file. Never deploy MIGRATION_DATABASE_URL. Complete pending additive database migrations before enabling the new workflow pages.

Actual Netlify Edge packaging/deployment must be confirmed from its next deploy log; local Next.js build success alone is not proof of a completed Netlify deployment.
