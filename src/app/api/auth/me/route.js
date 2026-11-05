import { authenticated } from '@/lib/server/auth';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor) => ({ user: actor }));
