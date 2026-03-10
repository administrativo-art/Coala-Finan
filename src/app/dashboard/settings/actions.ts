
'use server';

import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  const APP_NAME = 'admin-app';
  const apps = getApps();
  const existingApp = apps.find(a => a.name === APP_NAME);
  if (existingApp) return existingApp;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = 'coalafinan';

  try {
    // Tenta usar chaves se existirem (ambiente local com segredos)
    if (clientEmail && privateKey) {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      }, APP_NAME);
    }

    // Caso contrário, usa a Identidade Gerenciada (ADC)
    // Funciona no App Hosting, mas falha no Preview local sem chaves
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    }, APP_NAME);
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
    throw error;
  }
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
    
    // Erro específico para o ambiente de Preview
    if (error.message?.includes('Could not refresh access token') || error.message?.includes('credential')) {
      return { 
        success: false, 
        error: 'Erro de autenticação: Esta função (Criar usuário) só funciona no ambiente de produção (site publicado) ou se você tiver uma chave JSON configurada. No ambiente de Preview, o servidor não tem permissão para criar usuários no Auth.' 
      };
    }

    if (error.code === 'auth/email-already-exists') {
      return { success: false, error: 'Este e-mail já está em uso por outro usuário.' };
    }
    
    return { success: false, error: 'Erro ao criar usuário: ' + (error.message || 'Ocorreu um erro inesperado.') };
  }
}
