import { authenticated } from '@/lib/server/auth';
import { jsonBody } from '@/lib/server/api';
import {
  listReopenRequests,
  requestAssessmentReopen,
  reviewAssessmentReopen,
} from '@/lib/server/assessment-reopens';
export const runtime = 'nodejs';
export const GET = authenticated(async (_r, _c, actor, db) => listReopenRequests(db, actor));
export const POST = authenticated(async (r, _c, actor, db) =>
  requestAssessmentReopen(db, actor, await jsonBody(r)),
);
export const PATCH = authenticated(async (r, _c, actor, db) =>
  reviewAssessmentReopen(db, actor, await jsonBody(r)),
);
