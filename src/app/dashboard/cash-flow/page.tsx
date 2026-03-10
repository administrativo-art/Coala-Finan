
'use client';

import { useState, useMemo } from 'react';
import { collection, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, Wallet, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

import type { Account } from '@/types/account';
import type { Transaction } from '@/types/transaction';
import { TRANSACTION_TYPE_LABELS } from '@/types/transaction';
import { NewTransactionDialog } from '@/components/cash-flow/new-transaction-dialog';

const TYPE_COLOR: Record<string, string> = {
  revenue:           'text-emerald-400',
  revenue_recurring: 'text-emerald-400',
  transfer_in:       'text-sky-400',
  redemption:        'text-sky-400',
  expense_payment:   'text-rose-400',
  transfer_out:      'text-amber-400',
  adjustment:        'text-slate-400',
};

export default function CashFlowPage() {
  const firestore = useFirestore();
  const [accountFilter, setAccountFilter] = useState('all');
  const [monthsBack,    setMonthsBack]    = useState('3');
  const [dialogOpen,    setDialogOpen]    = useState(false);

  const accountsRef = useMemo(() => firestore ? collection(firestore, 'bankAccounts') : null, [firestore]);
  const transactionsRef = useMemo(() => firestore ? collection(firestore, 'transactions') : null, [firestore]);
  const paymentsRef = useMemo(() => firestore ? collection(firestore, 'payments') : null, [firestore]);

  const { data: accountsData } = useCollection<Account>(accountsRef);
  const { data: transactionsData, loading: loadingTx } = useCollection<Transaction>(transactionsRef);
  const { data: paymentsData, loading: loadingPay } = useCollection<any>(paymentsRef);

  const accounts = accountsData || [];
  const transactions = transactionsData || [];
  const payments = paymentsData || [];
  const loading = loadingTx || loadingPay;

  const months = parseInt(monthsBack);
  const periodStart = startOfMonth(subMonths(new Date(), months - 1));
  const periodEnd = endOfMonth(new Date());

  const allTx: Transaction[] = useMemo(() => {
    const paymentAsTx: Transaction[] = payments.flatMap(p => 
      (p.splits || []).map((s: any) => ({
        id: `${p.id}-${s.accountId}`,
        type: 'expense_payment' as const,
        direction: 'out' as const,
        accountId: s.accountId,
        accountName: s.accountName,
        paymentMethodLabel: s.paymentMethodLabel,
        amount: s.amount,
        date: p.paidAt,
        description: `Pagamento de despesa`,
        createdBy: p.createdBy,
        createdAt: p.createdAt,
      }))
    );

    return [...transactions, ...paymentAsTx].filter(tx => {
      const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date as any);
      const inPeriod = d >= periodStart && d <= periodEnd;
      const inAccount = accountFilter === 'all' || tx.accountId === accountFilter;
      return inPeriod && inAccount;
    }).sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date as any).getTime();
      const db = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date as any).getTime();
      return db - da;
    });
  }, [transactions, payments, accountFilter, periodStart, periodEnd]);

  const totals = useMemo(() => {
    const entradas = allTx.filter(t => t.direction === 'in' && t.type !== 'transfer_in').reduce((s, t) => s + t.amount, 0);
    const saidas = allTx.filter(t => t.direction === 'out' && t.type !== 'transfer_out').reduce((s, t) => s + t.amount, 0);
    const transf = allTx.filter(t => t.type === 'transfer_out').reduce((s, t) => s + t.amount, 0);
    return { entradas, saidas, saldo: entradas - saidas, transf };
  }, [allTx]);

  const chartData = useMemo(() => {
    const map: Record<string, { mes: string; entradas: number; saidas: number }> = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      map[key] = { mes: format(d, 'MMM/yy', { locale: ptBR }), entradas: 0, saidas: 0 };
    }
    allTx.forEach(tx => {
      const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date as any);
      const key = format(d, 'yyyy-MM');
      if (!map[key]) return;
      if (tx.direction === 'in' && tx.type !== 'transfer_in') map[key].entradas += tx.amount;
      if (tx.direction === 'out' && tx.type !== 'transfer_out') map[key].saidas += tx.amount;
    });
    return Object.values(map);
  }, [allTx, months]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Fluxo de caixa</h1>
          <p className="text-muted-foreground">Movimentações financeiras por conta e período.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-44"><Wallet className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.filter(a => a.active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={monthsBack} onValueChange={setMonthsBack}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo lançamento</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium">Entradas</CardTitle><TrendingUp className="h-4 w-4 text-emerald-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-500">{formatCurrency(totals.entradas)}</div></CardContent>
        </Card>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium">Saídas</CardTitle><TrendingDown className="h-4 w-4 text-rose-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-rose-500">{formatCurrency(totals.saidas)}</div></CardContent>
        </Card>
        <Card className="border-sky-500/20 bg-sky-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium">Transferências</CardTitle><ArrowLeftRight className="h-4 w-4 text-sky-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-sky-500">{formatCurrency(totals.transf)}</div></CardContent>
        </Card>
        <Card className={cn("border-primary/20", totals.saldo >= 0 ? "bg-emerald-500/5" : "bg-rose-500/5")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium">Saldo líquido</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className={cn("text-2xl font-bold", totals.saldo >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatCurrency(totals.saldo)}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Entradas vs Saídas</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `R$${v/1000}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lançamentos recentes</CardTitle></CardHeader>
          <CardContent className="px-0">
            <div className="max-h-[400px] overflow-y-auto px-6 space-y-4">
              {loading ? <Skeleton className="h-40 w-full" /> : allTx.length === 0 ? <p className="text-center py-10 text-muted-foreground text-sm">Nenhuma transação encontrada.</p> : allTx.slice(0, 10).map(tx => {
                const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date as any);
                return (
                  <div key={tx.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{format(d, 'dd/MM/yyyy')} • {tx.accountName}</p>
                    </div>
                    <div className={cn("text-sm font-mono font-bold", tx.direction === 'in' ? 'text-emerald-500' : 'text-rose-500')}>
                      {tx.direction === 'in' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <NewTransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
