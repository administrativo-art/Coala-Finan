'use server';

import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount: ServiceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function createUserAction(data: {
  name: string;
  email: string;
  password: string;
  profile: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const app = getAdminApp();
    const adminAuth = getAuth(app);
    const adminDb = getFirestore(app);

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
    });

    // Create user profile in Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      name: data.name,
      email: data.email,
      profile: data.profile,
    });

    return { success: true };
  } catch (error: any) {
    console.error('createUserAction error:', error);
    if (error.code === 'auth/email-already-exists') {
      return { success: false, error: 'Este e-mail já está em uso.' };
    }
    return { success: false, error: 'Ocorreu um erro ao criar o usuário no servidor.' };
  }
}