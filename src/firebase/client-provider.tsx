'use client';

import React, { ReactNode } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

type FirebaseClientProviderProps = {
  children: ReactNode;
};

const firebaseInstances = initializeFirebase();

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  return <FirebaseProvider value={firebaseInstances}>{children}</FirebaseProvider>;
}
