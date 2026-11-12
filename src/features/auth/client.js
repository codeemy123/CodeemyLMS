'use client';
import { readAuthResponse } from './response.js';
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
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';
let pending;
export function clientAuth() {
  return (pending ||= (async () => {
    const response = await fetch('/api/auth/config', { cache: 'no-store' });
    const config = await readAuthResponse(response);
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
  if (google) {
    const result = await googleAccess();
    return result;
  }
  const auth = await clientAuth();
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await credential.user.getIdToken() }),
    });
    const data = await readAuthResponse(response);
    if (!response.ok) throw new Error(data.error || 'Unable to create session.');
    if (!['ADMIN', 'MENTOR', 'STUDENT'].includes(data.role))
      throw new Error('Account role is invalid.');
    return '/' + data.role.toLowerCase() + '/dashboard';
  } finally {
    await signOut(auth);
  }
}
export async function googleAccess() {
  const auth = await clientAuth();
  let completingRegistration = false;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await credential.user.getIdToken() }),
    });
    const data = await readAuthResponse(response);
    if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
    if (data.needsRegistration === true) {
      completingRegistration = true;
      return { needsRegistration: true, profile: data.profile };
    }
    if (!['ADMIN', 'MENTOR', 'STUDENT'].includes(data.role))
      throw new Error('Account role is invalid.');
    return '/' + data.role.toLowerCase() + '/dashboard';
  } finally {
    if (!completingRegistration) await signOut(auth);
  }
}
export async function cancelGoogleRegistration() {
  await signOut(await clientAuth());
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
  if (typeof details.password !== 'string' || details.password.length < 12)
    throw new Error('Create a password with at least 12 characters.');
  if (details.password !== details.confirmPassword) throw new Error('Passwords do not match.');
  const auth = await clientAuth();
  try {
    let credential;
    if (google) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      credential = auth.currentUser?.providerData.some((p) => p.providerId === 'google.com')
        ? { user: auth.currentUser }
        : await signInWithPopup(auth, provider);
      const user = credential.user;
      if (!user.email || user.email.toLowerCase() !== details.email?.trim().toLowerCase())
        throw new Error(
          'Your Google account changed. Select the same account or start registration again.',
        );
      if (user.providerData.some((p) => p.providerId === 'password')) {
        credential = await signInWithEmailAndPassword(auth, user.email, details.password);
        if (credential.user.uid !== user.uid)
          throw new Error('Sign in to your existing account before registering.');
      } else {
        credential = await linkWithCredential(
          user,
          EmailAuthProvider.credential(user.email, details.password),
        );
      }
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
        idToken: await credential.user.getIdToken(true),
        fullName: details.fullName,
        role: details.role,
        phone: details.phone,
        college: details.college,
        qualification: details.qualification,
        message: details.message,
      }),
    });
    const result = await readAuthResponse(response);
    if (!response.ok) throw new Error(result.error || 'Registration could not be submitted.');
    return result;
  } finally {
    await signOut(auth);
  }
}
