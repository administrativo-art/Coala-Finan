'use client';

import { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  DocumentData,
  DocumentReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export function useDoc<T = DocumentData>(
  docRef: DocumentReference<T> | null
) {
  const [data, setData] = useState<(T & { id: string; }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offline, setOffline] = useState(false);
  const retryCount = useRef(0);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      setData(null);
      return;
    }
    
    setLoading(true);

    function subscribe() {
      if (retryTimeout.current) clearTimeout(retryTimeout.current);

      const unsubscribe = onSnapshot(
        docRef!,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (snapshot.exists()) {
            setData({ ...snapshot.data() as T, id: snapshot.id });
          } else {
            setData(null);
          }
          setLoading(false);
          setError(null);
          setOffline(snapshot.metadata.fromCache);
          retryCount.current = 0; // Reset retry count on success
        },
        async (serverError) => {
          // Trata erros de conexão/offline de forma silenciosa
          const isNetworkError = 
            serverError.code === 'unavailable' || 
            serverError.code === 'unknown' ||
            serverError.message.toLowerCase().includes('offline') ||
            serverError.message.toLowerCase().includes('network');

          if (isNetworkError) {
            setOffline(true);
            setLoading(false);

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

          // Apenas erros de permissão devem ser emitidos
          if (serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
              path: docRef!.path,
              operation: 'get',
            } satisfies SecurityRuleContext);
            
            errorEmitter.emit('permission-error', permissionError);
            setError(permissionError);
          }

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
  }, [docRef]);

  return { data, loading, error, offline };
}
