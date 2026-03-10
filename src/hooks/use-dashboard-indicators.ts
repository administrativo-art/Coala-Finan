'use client';

import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

function toDate(ts: Timestamp | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof (ts as any)?.toDate === 'function') return (ts as any).toDate();
  return new Date(ts as any);
}

export function useDashboardIndicators() {
  const firestore = useFirestore();

  const expensesRef = useMemo(() => (firestore ? collection(firestore, 'expenses') : null), [firestore]);
  const transactionsRef = useMemo(() => (firestore ? collection(firestore, 'transactions') : null), [firestore]);
  const paymentsRef = useMemo(() => (firestore ? collection(firestore, 'payments') : null), [firestore]);

  const { data: expensesData, loading: le } = useCollection<any>(expensesRef);
  const { data: transactionsData, loading: lt } = useCollection<any>(transactionsRef);
  const { data: paymentsData, loading: lp } = useCollection<any>(paymentsRef);

  const expenses = expensesData || [];
  const transactions = transactionsData || [];
  const payments = paymentsData || [];

  const loading = le || lt || lp;

  const indicators = useMemo(() => {
    const now = startOfDay(new Date());
    const in30Days = endOfDay(addDays(now, 30));

    // 1. Despesas em aberto (pending)
    const despesasEmAberto = expenses
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + (e.totalValue ?? 0), 0);

    // 2. Próximos vencimentos (pending nos próximos 30 dias)
    const proximosVencimentos = expenses
      .filter(e => {
        if (e.status !== 'pending') return false;
        const due = toDate(e.dueDate);
        return due && due >= now && due <= in30Days;
      })
      .reduce((sum, e) => sum + (e.totalValue ?? 0), 0);

    // 3. Receitas totais (direction=in, exceto transferências internas)
    const totalReceitas = transactions
      .filter((t: any) => t.direction === 'in' && t.type !== 'transfer_in')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    // 4. Despesas pagas totais (payments efetuados)
    const totalPago = payments
      .reduce((sum, p) => sum + (p.totalPaid ?? 0), 0);

    // DRE = Receitas - Despesas pagas
    const dre = totalReceitas - totalPago;

    // Caixa = Receitas - Pagamentos efetuados + Ajustes de entrada - Ajustes de saída
    const totalSaidasTx = transactions
      .filter((t: any) => t.direction === 'out' && t.type !== 'transfer_out')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    const caixa = totalReceitas - totalPago - totalSaidasTx;

    return {
      despesasEmAberto,
      proximosVencimentos,
      dre,
      caixa,
    };
  }, [expenses, transactions, payments]);

  return { indicators, loading, expenses };
}
