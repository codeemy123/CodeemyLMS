import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Match local Next.js configuration without exposing secrets to the browser.
config({ path: ['.env.local', '.env'], quiet: true });
const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Never run migrations through the limited runtime application connection.
  ...(migrationDatabaseUrl ? { datasource: { url: migrationDatabaseUrl } } : {}),
});
