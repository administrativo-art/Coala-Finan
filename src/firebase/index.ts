import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  Firestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';
import { firebaseConfig } from './config';

// Hooks and providers
export { FirebaseProvider, useFirebase, useFirebaseApp, useFirestore, useAuth } from './provider';
export { useUser } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';

type FirebaseInstances = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

let firebaseInstances: FirebaseInstances | null = null;

export function initializeFirebase(): FirebaseInstances {
  if (firebaseInstances) {
    return firebaseInstances;
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  
  let firestore: Firestore;
  
  try {
    // Inicializa o Firestore com cache persistente no IndexedDB
    // Isso permite que o app funcione offline e carregue dados instantaneamente do cache
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (e) {
    // Caso já tenha sido inicializado (comum no Hot Reload do Next.js)
    // usamos getFirestore para recuperar a instância existente
    firestore = getFirestore(app);
  }

  firebaseInstances = { app, auth, firestore };
  return firebaseInstances;
}
