'use client';

import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { addDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

export function useDashboardIndicators() {
  const firestore = useFirestore();

  const expensesRef = useMemo(() => (firestore ? collection(firestore, 'expenses') : null), [firestore]);
  const { data: expenses, loading } = useCollection(expensesRef);

  const indicators = useMemo(() => {
    if (!expenses) return null;

    const now = startOfDay(new Date());
    const in30Days = endOfDay(addDays(now, 30));

    const pendingExpenses = expenses.filter(e => e.status === 'pending');
    const paidExpenses = expenses.filter(e => e.status === 'paid');

    const despesasEmAberto = pendingExpenses.reduce(
      (sum, e) => sum + (e.totalValue ?? 0), 0
    );

    const proximosVencimentos = pendingExpenses
      .filter(e => {
        if (!e.dueDate) return false;
        const due = e.dueDate.toDate ? e.dueDate.toDate() : new Date(e.dueDate);
        return (isAfter(due, now) || due.getTime() === now.getTime()) && isBefore(due, in30Days);
      })
      .reduce((sum, e) => sum + (e.totalValue ?? 0), 0);

    const totalPago = paidExpenses.reduce(
      (sum, e) => sum + (e.totalValue ?? 0), 0
    );

    // Simplified DRE: negative of paid expenses until income is implemented
    const dre = -totalPago;

    return {
      despesasEmAberto,
      proximosVencimentos,
      dre,
      // Cash will come from another collection in the future
      caixa: null,
    };
  }, [expenses]);

  return { indicators, loading, expenses };
}