'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, CircleDollarSign, LineChart, Wallet } from 'lucide-react';
import { useDashboardIndicators } from '@/hooks/use-dashboard-indicators';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';

function formatCurrency(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function DashboardPage() {
  const { indicators, loading, expenses } = useDashboardIndicators();

  const cards = [
    {
      title: 'Caixa',
      value: formatCurrency(indicators?.caixa ?? null),
      icon: Wallet,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
      note: 'Em breve',
    },
    {
      title: 'DRE (resultado)',
      value: formatCurrency(indicators?.dre ?? null),
      icon: LineChart,
      color: indicators?.dre != null && indicators.dre >= 0
        ? 'text-emerald-500' : 'text-rose-500',
      bg: indicators?.dre != null && indicators.dre >= 0
        ? 'bg-emerald-500/10' : 'bg-rose-500/10',
    },
    {
      title: 'Despesas em aberto',
      value: formatCurrency(indicators?.despesasEmAberto ?? null),
      icon: CircleDollarSign,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'Próximos 30 dias',
      value: formatCurrency(indicators?.proximosVencimentos ?? null),
      icon: CalendarClock,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline text-3xl font-bold tracking-tight">Painel</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-lg transition-transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={cn('rounded-full p-2', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{card.value}</div>
                  {card.note && (
                    <p className="text-xs text-muted-foreground mt-1">{card.note}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Atividade recente</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentExpenses expenses={expenses} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}

function RecentExpenses({ expenses, loading }: { expenses: any[] | null, loading: boolean }) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!expenses || expenses.length === 0) return (
    <div className="flex h-48 items-center justify-center rounded-md border-2 border-dashed">
      <p className="text-muted-foreground">Nenhuma despesa registrada ainda.</p>
    </div>
  );

  const recent = [...expenses]
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {recent.map(exp => (
        <div key={exp.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
          <div className="space-y-1">
            <p className="font-medium">{exp.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{exp.accountPlanName || exp.accountPlan}</span>
              {exp.supplier && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="font-medium text-primary/80">{exp.supplier}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold text-rose-500">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(exp.totalValue)}
            </p>
            <p className="text-xs text-muted-foreground capitalize">{exp.status === 'pending' ? 'Pendente' : 'Pago'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
