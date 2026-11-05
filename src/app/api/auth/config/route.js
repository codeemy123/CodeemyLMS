export const dynamic = 'force-dynamic';
export function GET() {
  const enabled = process.env.LMS_DATABASE_MODE === 'true';
  const firebase = {
    apiKey: process.env.FIREBASE_WEB_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
  };
  return Response.json(
    {
      mode: enabled ? 'database' : 'preview',
      configured: Object.values(firebase).every(Boolean),
      firebase,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
