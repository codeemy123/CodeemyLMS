# PostgreSQL / Prisma setup

Prisma CLI and Prisma Client are installed at version 7.10.1. The CLI is a development dependency; the client and dotenv are runtime dependencies. Prisma 7 is pinned to avoid the registry's Prisma 8 release candidate.

- `prisma/schema.prisma`: PostgreSQL datasource and client generator; no database models yet.
- `prisma7.config.js`: JavaScript configuration discovered by Prisma 7. Loads `.env.local` and `.env` without overwriting shell-provided variables.
- `.env`: `DATABASE_URL` is intentionally empty until a PostgreSQL database is provisioned. All local environment files are ignored by Git.
- `.env.example`: documents the empty variable for future setup.
- Generated client output is configured at `src/generated/prisma` and ignored by Git. Client generation is not performed yet because there are no models.

Check the scaffold without connecting to a database:

```powershell
npm ls prisma @prisma/client dotenv --depth=0
npm run db:validate
```

For reference, initializing a fresh project can skip optional agent-skill installation:

```powershell
npx prisma init --datasource-provider postgresql --no-skills
```

Do not rerun initialization over the existing scaffold. No database has been provisioned, queried or migrated. No LMS data has been moved: existing workflows still use localStorage, and media storage uses the separate R2 integration.

After database provisioning, configure its connection securely, implement the actual models and PostgreSQL driver adapter, create reviewed migrations and backend APIs, then migrate application data. The existing database schema document remains a design proposal.

The install audit reports a critical advisory against the existing Next.js dependency. No unrelated framework upgrade or forced audit fix was performed as part of this scaffold setup.
