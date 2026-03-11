'use server';

import { initializeApp, getApps, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Inicializa o app administrativo de forma segura.
 * Tenta reaproveitar instâncias existentes para evitar erros de inicialização duplicada.
 */
function getAdminApp(): App {
  const APP_NAME = 'admin-app';
  const apps = getApps();
  const existingApp = apps.find(a => a.name === APP_NAME);
  if (existingApp) return existingApp;

  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId: 'coalafinan',
    }, APP_NAME);
  } catch (error) {
    // Fallback para o app padrão se a inicialização do app nomeado falhar
    if (apps.length > 0) return apps[0];
    throw error;
  }
}

/**
 * Obtém a instância do Firestore para o banco de dados específico.
 */
function getAdminDb(): Firestore {
  const app = getAdminApp();
  // Em firebase-admin modular, o databaseId é o segundo argumento
  return getFirestore(app, 'coalafinan');
}

export async function createUserAction(data: {
  name: string;
  email: string;
  password: string;
  profile: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'Chave de API do Firebase não configurada no servidor.' };
    }

    // 1. Criar usuário no Firebase Auth via Identity Toolkit REST API
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
      const message = json?.error?.message;
      if (message === 'EMAIL_EXISTS') {
        return { success: false, error: 'Este e-mail já está em uso por outro usuário.' };
      }
      return { success: false, error: 'Erro ao criar usuário no Auth: ' + (message || 'Erro desconhecido') };
    }

    const uid = json.localId;

    // 2. Salvar perfil no Firestore 'coalafinan'
    const adminDb = getAdminDb();
    await adminDb.collection('users').doc(uid).set({
      name: data.name,
      email: data.email,
      profile: data.profile || '',
      active: true,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('createUserAction error:', error);
    return { 
      success: false, 
      error: 'Erro interno ao processar a criação: ' + (error.message || 'Verifique os logs do servidor.') 
    };
  }
}
