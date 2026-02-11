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

  useEffect(() => {
    if (!q) {
      setLoading(false);
      setData(null);
      return;
    };
    
    setLoading(true);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
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

  return { data, loading, error };
}
