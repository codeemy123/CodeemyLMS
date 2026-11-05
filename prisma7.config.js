import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Match local Next.js configuration without exposing secrets to the browser.
config({ path: ['.env.local', '.env'], quiet: true });
const databaseUrl = (process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL)?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Schema validation works before a database exists. DB commands require a real URL.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
