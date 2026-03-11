'use server';

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Inicializa o app administrativo usando ADC (Application Default Credentials).
 * Em produção (App Hosting), isso usa a identidade do servidor automaticamente.
 * Em desenvolvimento local, exige o comando `gcloud auth application-default login`
 * ou a variável GOOGLE_APPLICATION_CREDENTIALS apontando para um JSON.
 */
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
    
    // Tratamento de erro para ambiente de desenvolvimento ou falta de permissão
    if (error.message?.includes('Could not refresh access token') || error.message?.includes('credential')) {
      return { 
        success: false, 
        error: 'Erro de autenticação: O servidor não possui uma identidade configurada. Em produção, verifique as permissões IAM. Em preview local, esta função não está disponível sem chaves manuais.' 
      };
    }

    if (error.code === 'auth/email-already-exists') {
      return { success: false, error: 'Este e-mail já está em uso por outro usuário.' };
    }
    
    return { success: false, error: 'Erro ao criar usuário: ' + (error.message || 'Ocorreu um erro inesperado.') };
  }
}
