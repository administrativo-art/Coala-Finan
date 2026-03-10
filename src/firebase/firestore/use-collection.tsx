'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  Query,
  DocumentData,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useCollection<T = DocumentData>(
  q: Query<T> | CollectionReference<T> | null
) {
  const [data, setData] = useState<(T & { id: string; })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!q) {
      setLoading(false);
      setData(null);
      return;
    };
    
    setLoading(true);

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
        setData(docs);
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

        let path = 'unknown collection path';
        if (q && 'path' in q && typeof q.path === 'string') {
            path = q.path;
        }

        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
        setData(null);
      }
    );

    return () => unsubscribe();
  }, [q]);

  return { data, loading, error, offline };
}
