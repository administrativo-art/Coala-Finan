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
        const docs = snapshot.docs.map((doc) => ({ ...doc.data() as T, id: doc.id }));
        setData(docs);
        setLoading(false);
        setError(null);
        setOffline(snapshot.metadata.fromCache);
      },
      (err) => {
        // Trata erros de conexão/offline como estado e não como falha crítica
        const isOfflineError = 
          err.code === 'unavailable' || 
          err.code === 'unknown' ||
          err.message.toLowerCase().includes('offline') ||
          err.message.toLowerCase().includes('network');

        if (isOfflineError) {
          setOffline(true);
          setLoading(false);
          // Não limpamos os dados existentes para permitir leitura do cache
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
