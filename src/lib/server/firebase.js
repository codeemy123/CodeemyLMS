import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ApiError } from './api.js';
export function firebaseAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new ApiError(503, 'Firebase Authentication is not configured.');
  const app =
    getApps().find((a) => a.name === 'codeemy-auth') ||
    initializeApp({ projectId, credential: applicationDefault() }, 'codeemy-auth');
  return getAuth(app);
}
