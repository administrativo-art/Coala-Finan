'use client';

import React, { ReactNode, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

type FirebaseClientProviderProps = {
  children: ReactNode;
};

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // O useState com uma função inicializadora garante que initializeFirebase
  // seja chamado apenas uma vez no cliente, evitando conflitos de instâncias
  // que ocorrem frequentemente com o Hot Reload do Turbopack.
  const [firebaseInstances] = useState(() => initializeFirebase());

  return <FirebaseProvider value={firebaseInstances}>{children}</FirebaseProvider>;
}
