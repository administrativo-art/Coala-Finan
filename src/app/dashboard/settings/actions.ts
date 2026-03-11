'use server';

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  const APP_NAME = 'admin-app';
  const apps = getApps();
  const existingApp = apps.find(a => a.name === APP_NAME);
  if (existingApp) return existingApp;

  return initializeApp({
    credential: applicationDefault(),
    projectId: 'coalafinan',
  }, APP_NAME);
}

export async function createUserAction(data: {
  name: string;
  email: string;
  password: string;
  profile: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          returnSecureToken: true,
        }),
      }
    );

    const json = await res.json();

    if (!res.ok) {
      const code = json?.error?.message;
      if (code === 'EMAIL_EXISTS') {
        return { success: false, error: 'Este e-mail já está em uso por outro usuário.' };
      }
      return { success: false, error: 'Erro ao criar usuário: ' + code };
    }

    const uid = json.localId;

    const app = getAdminApp();
    const adminDb = getFirestore(app, 'coalafinan');
    await adminDb.collection('users').doc(uid).set({
      name: data.name,
      email: data.email,
      profile: data.profile,
      active: true,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('createUserAction error:', error);
    return { success: false, error: 'Erro inesperado: ' + (error.message || '') };
  }
}
