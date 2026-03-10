'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se o serviço de autenticação ainda não estiver pronto, mantemos o estado de loading.
    // Não chamamos setLoading(false) aqui para evitar redirecionamentos errôneos
    // antes da inicialização do SDK.
    if (!auth) return;

    // O onAuthStateChanged é assíncrono. Ele verifica se há um token persistido
    // e restaura a sessão. Só alteramos o loading após essa primeira verificação.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
