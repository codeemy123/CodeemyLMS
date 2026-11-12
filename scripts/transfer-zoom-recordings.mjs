import { config } from 'dotenv';
import { getPrisma } from '../src/lib/prisma.js';
import { transferNextRecording } from '../src/lib/server/recording-transfer.js';
config({ path: ['.env.local', '.env'], quiet: true });
const db = getPrisma();
try {
  for (let i = 0; i < 1; i++) if (!(await transferNextRecording(db))) break;
} finally {
  await db.$disconnect();
}
