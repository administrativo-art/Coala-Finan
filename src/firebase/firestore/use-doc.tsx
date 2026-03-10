'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  DocumentData,
  DocumentReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useDoc<T = DocumentData>(
  docRef: DocumentReference<T> | null
) {
  const [data, setData] = useState<(T & { id: string; }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      setData(null);
      return;
    }
    
    setLoading(true);

    const unsubscribe = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ ...snapshot.data(), id: snapshot.id });
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
        setOffline(snapshot.metadata.fromCache);
      },
      (err) => {
        // Se o erro for por estar offline, tratamos como um estado e não como erro crítico
        if (err.code === 'unavailable' || err.message.toLowerCase().includes('offline')) {
          setOffline(true);
          setLoading(false);
          return;
        }

        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
        setData(null);
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, loading, error, offline };
}
