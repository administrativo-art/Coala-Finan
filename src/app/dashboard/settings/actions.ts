
'use server';

import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = 'coalafinan';

  // Se as variáveis de ambiente existirem (ex: em dev local ou se conseguir configurar no futuro)
  if (clientEmail && privateKey) {
    const serviceAccount: ServiceAccount = {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };

    return initializeApp({
      credential: cert(serviceAccount),
    }, 'admin-app');
  }

  // Caso contrário, tenta usar a Identidade da Hospedagem (ADC)
  // Isso funciona automaticamente no Firebase App Hosting se as permissões IAM estiverem corretas
  return initializeApp({
    projectId,
  }, 'admin-app');
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
    
    // Erros comuns de permissão para ajudar no debug
    if (error.code === 'insufficient-permissions' || error.message?.includes('permission')) {
      return { 
        success: false, 
        error: 'Erro de permissão: Certifique-se de que a conta de serviço do App Hosting tem o papel "Administrador do Firebase Authentication" no console IAM.' 
      };
    }

    if (error.code === 'auth/email-already-exists') {
      return { success: false, error: 'Este e-mail já está em uso por outro usuário.' };
    }
    return { success: false, error: 'Erro ao criar usuário: ' + (error.message || 'Ocorreu um erro inesperado.') };
  }
}
