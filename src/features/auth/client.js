'use client';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  setPersistence,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
let pending;
export function clientAuth() {
  return (pending ||= (async () => {
    const response = await fetch('/api/auth/config', { cache: 'no-store' });
    const config = await response.json();
    if (!config.configured)
      throw new Error('Sign-in is not configured. Contact your administrator.');
    const app =
      getApps().find((app) => app.name === 'codeemy-web') ||
      initializeApp(config.firebase, 'codeemy-web');
    const auth = getAuth(app);
    await setPersistence(auth, inMemoryPersistence);
    return auth;
  })().catch((error) => {
    pending = null;
    throw error;
  }));
}
export async function login(email, password, google = false) {
  const auth = await clientAuth();
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = google
      ? await signInWithPopup(auth, provider)
      : await signInWithEmailAndPassword(auth, email, password);
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await credential.user.getIdToken() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to create session.');
    if (!['ADMIN', 'MENTOR', 'STUDENT'].includes(data.role))
      throw new Error('Account role is invalid.');
    return '/' + data.role.toLowerCase() + '/dashboard';
  } finally {
    await signOut(auth);
  }
}
export async function logout() {
  const response = await fetch('/api/auth/session', { method: 'DELETE' });
  if (!response.ok) throw new Error('Unable to sign out. Please try again.');
  if (pending) await signOut(await pending);
}
export async function resetPassword(email) {
  await sendPasswordResetEmail(await clientAuth(), email);
}
export function authMessage(error) {
  const messages = {
    'auth/weak-password': 'Use a stronger password with at least 12 characters.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Allow popups for this site, then try again.',
    'auth/unauthorized-domain': 'This website domain is not authorized in Firebase.',
    'auth/account-exists-with-different-credential':
      'Sign in with your existing email/password first.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Check your internet connection and try again.',
  };
  return messages[error.code] || (error.code ? 'Sign-in failed. Please try again.' : error.message);
}

export async function registerAccount(details, google = false) {
  const auth = await clientAuth();
  try {
    let credential;
    if (google) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      credential = await signInWithPopup(auth, provider);
    } else {
      try {
        credential = await createUserWithEmailAndPassword(auth, details.email, details.password);
      } catch (error) {
        if (error.code !== 'auth/email-already-in-use') throw error;
        credential = await signInWithEmailAndPassword(auth, details.email, details.password);
      }
    }
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: await credential.user.getIdToken(),
        fullName: details.fullName,
        role: details.role,
        phone: details.phone,
        college: details.college,
        qualification: details.qualification,
        message: details.message,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Registration could not be submitted.');
    return result;
  } finally {
    await signOut(auth);
  }
}
