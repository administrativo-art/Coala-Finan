'use client';

import { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  Query,
  DocumentData,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export function useCollection<T = DocumentData>(
  q: Query<T> | CollectionReference<T> | null
) {
  const [data, setData] = useState<(T & { id: string; })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offline, setOffline] = useState(false);
  const retryCount = useRef(0);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q) {
      setLoading(false);
      setData(null);
      return;
    };
    
    setLoading(true);

    function subscribe() {
      if (retryTimeout.current) clearTimeout(retryTimeout.current);

      const unsubscribe = onSnapshot(
        q!,
        { includeMetadataChanges: true },
        (snapshot) => {
          const docs = snapshot.docs.map((doc) => ({ ...doc.data() as T, id: doc.id }));
          setData(docs);
          setLoading(false);
          setError(null);
          setOffline(snapshot.metadata.fromCache);
          retryCount.current = 0; // Reset retry count on success
        },
        async (serverError) => {
          // Trata erros de conexão/offline com retry exponencial
          const isOfflineError = 
            serverError.code === 'unavailable' || 
            serverError.code === 'unknown' ||
            serverError.message.toLowerCase().includes('offline') ||
            serverError.message.toLowerCase().includes('network');

          if (isOfflineError) {
            setOffline(true);
            if (retryCount.current < 5) {
              const delay = Math.min(1000 * Math.pow(2, retryCount.current), 16000);
              retryCount.current += 1;
              retryTimeout.current = setTimeout(() => {
                subscribe();
              }, delay);
              return;
            }
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
          } satisfies SecurityRuleContext);
          
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
          setLoading(false);
          setData(null);
        }
      );

      return unsubscribe;
    }

    const unsubscribe = subscribe();

    return () => {
      if (unsubscribe) unsubscribe();
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
    };
  }, [q]);

  return { data, loading, error, offline };
}
