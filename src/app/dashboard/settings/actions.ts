'use server';

import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = 'coalafinan';

  if (!clientEmail || !privateKey) {
    throw new Error('CONFIG_MISSING');
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
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
    let app;
    try {
      app = getAdminApp();
    } catch (e: any) {
      if (e.message === 'CONFIG_MISSING') {
        return { 
          success: false, 
          error: 'Configuração ausente: Os segredos FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY não foram encontrados no ambiente de execução.' 
        };
      }
      throw e;
    }

    const adminAuth = getAuth(app);
    const adminDb = getFirestore(app);

    // Cria o usuário no Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
    });

    // Cria o perfil do usuário no Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      name: data.name,
      email: data.email,
      profile: data.profile,
      active: true,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('createUserAction error:', error);
    if (error.code === 'auth/email-already-exists') {
      return { success: false, error: 'Este e-mail já está em uso por outro usuário.' };
    }
    return { success: false, error: 'Erro ao criar usuário: ' + (error.message || 'Ocorreu um erro inesperado no servidor.') };
  }
}
