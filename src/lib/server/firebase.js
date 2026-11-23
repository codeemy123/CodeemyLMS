import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ApiError } from './api.js';
function firebaseCredential(environment) {
  const raw = environment.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return applicationDefault();

  try {
    const account = JSON.parse(raw);
    if (!account.project_id || !account.client_email || !account.private_key) throw new Error();
    return cert(account);
  } catch {
    throw new ApiError(503, 'Firebase server credentials are invalid.');
  }
}

export function firebaseAuth(environment = process.env) {
  const projectId = environment.FIREBASE_PROJECT_ID;
  if (!projectId) throw new ApiError(503, 'Firebase Authentication is not configured.');
  const app =
    getApps().find((a) => a.name === 'codeemy-auth') ||
    initializeApp({ projectId, credential: firebaseCredential(environment) }, 'codeemy-auth');
  return getAuth(app);
}
