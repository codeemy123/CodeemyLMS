# Netlify deployment

The build command is `npm run build` and publish directory is `.next`; Node 24 is configured in netlify.toml. The build generates the ignored Prisma client before compiling Next.js. Never commit generated clients or local environment files to work around missing build output.

Bucket names and Firebase project IDs are public resource identifiers. Netlify's scan flags their ordinary occurrences in package names/docs if those variables are marked secret in the dashboard. netlify.toml excludes only CLOUDFLARE_R2_BUCKET_NAME and FIREBASE_PROJECT_ID from value matching. DATABASE_URL, R2 access/secret keys, Firebase private keys and other credentials remain scanned. Do not disable the scanner globally or exclude whole source/build directories.

## Middleware compatibility

Netlify's Next.js adapter packages Proxy/middleware in an Edge wrapper. Importing Firebase Admin, Prisma or `pg` into src/proxy.js breaks this bundling. Proxy now performs only the early missing-cookie/legacy-login redirects and forwards the canonical workspace section in an overwritten request header.

The shared workspace server layout verifies the actual Firebase session and active database role before rendering the workspace. Each role layout also enforces its fixed role, so request headers cannot authorize a different portal. These layouts run on Node. Every protected API separately verifies the actor and its resource scope; cookie presence is never treated as authentication.

Next.js can emit a meta redirect after streaming has started. Verification scripts check the actual redirect target, and browser tests confirm forged cookies land on /login while /api/auth/me rejects them with 401. Tests do not treat an arbitrary 200 response as a redirect.

## Runtime configuration still required

A successful build does not establish database/auth connectivity. Netlify cannot use a localhost database URL, Cloud Run's /cloudsql socket, a local ADC file, or Cloud Run's service identity. Configure an appropriate secured Cloud SQL connection and Firebase Admin credentials for the Netlify runtime separately. Keep database and R2 credentials secret, do not deploy MIGRATION_DATABASE_URL, and complete the pending additive database migrations before enabling the new workflow pages.

Actual Netlify Edge packaging/deployment must be confirmed from its next deploy log; local Next.js build success alone is not proof of a completed Netlify deployment.
