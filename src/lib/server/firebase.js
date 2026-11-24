import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ApiError } from './api.js';
import fs from 'fs';

function firebaseCredential(environment) {
  const raw = environment.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      const account = JSON.parse(raw);
      if (!account.project_id || !account.client_email || !account.private_key) throw new Error();
      return cert(account);
    } catch {
      throw new ApiError(503, 'Firebase server credentials are invalid.');
    }
  }

  // Check known credential file paths on VPS
  const candidatePaths = [
    environment.GOOGLE_APPLICATION_CREDENTIALS,
    'C:\\LMS\\Backend\\Deployments\\shared\\firebase-service-account.json',
    'C:\\LMS\\Backend\\firebase-service-account.json',
  ].filter(Boolean);

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const account = JSON.parse(fileContent);
        if (account.project_id && account.client_email && account.private_key) {
          return cert(account);
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return applicationDefault();
}

export function firebaseAuth(environment = process.env) {
  let projectId = environment.FIREBASE_PROJECT_ID;
  if (!projectId) {
    const candidatePaths = [
      environment.GOOGLE_APPLICATION_CREDENTIALS,
      'C:\\LMS\\Backend\\Deployments\\shared\\firebase-service-account.json',
      'C:\\LMS\\Backend\\firebase-service-account.json',
    ].filter(Boolean);

    for (const filePath of candidatePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const account = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (account.project_id) {
            projectId = account.project_id;
            break;
          }
        }
      } catch {}
    }
  }
  if (!projectId) projectId = 'codeemylms';

  const app =
    getApps().find((a) => a.name === 'codeemy-auth') ||
    initializeApp({ projectId, credential: firebaseCredential(environment) }, 'codeemy-auth');
  return getAuth(app);
}
