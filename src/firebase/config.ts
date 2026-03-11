// Função para carregar a configuração do Firebase dinamicamente
function getFirebaseConfig() {
  // No App Hosting, a configuração é injetada automaticamente via FIREBASE_WEBAPP_CONFIG
  if (process.env.FIREBASE_WEBAPP_CONFIG) {
    try {
      return JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
    } catch (e) {
      console.error('Erro ao processar FIREBASE_WEBAPP_CONFIG:', e);
    }
  }

  // Fallback para desenvolvimento local via variáveis de ambiente individuais
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export const firebaseConfig = getFirebaseConfig();
