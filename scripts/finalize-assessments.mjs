import { config } from 'dotenv';
import { getPrisma } from '../src/lib/prisma.js';
import { finalizeExpiredAssessments } from '../src/lib/server/assessment-workflows.js';
config({ path: ['.env.local', '.env'], quiet: true });
const db = getPrisma();
try {
  console.log('Expired assessments finalized:', await finalizeExpiredAssessments(db));
} finally {
  await db.$disconnect();
}
