'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, CircleDollarSign, LineChart, Wallet } from 'lucide-react';
import { useDashboardIndicators } from '@/hooks/use-dashboard-indicators';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection } from '@/firebase';
import { collection, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof ts?.toDate === 'function') return ts.toDate();
  return new Date(ts);
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid: { label: 'Pago', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  overdue: { label: 'Vencido', className: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  pending: { label: 'Em aberto', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
};

export default function DashboardPage() {
  const { indicators, loading, expenses } = useDashboardIndicators();

  const cards = [
    {
      title: 'Caixa',
      value: formatCurrency(indicators?.caixa ?? null),
      icon: Wallet,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
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
          <Card key={card.title} className="shadow-lg transition-transform hover:scale-[1.02]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</CardTitle>
              <div className={cn('rounded-full p-2', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold tracking-tight">{card.value}</div>
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
      <p className="text-muted-foreground text-sm">Nenhuma despesa registrada ainda.</p>
    </div>
  );

  const recent = [...expenses]
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {recent.map(exp => {
        const due = toDate(exp.dueDate);
        const now = new Date();
        let statusKey = exp.status;
        if (exp.status === 'pending' && due && due < now) {
          statusKey = 'overdue';
        }
        const cfg = STATUS_CONFIG[statusKey] || { label: exp.status, className: '' };

        return (
          <div key={exp.id} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/30 transition-colors">
            <div className="space-y-1">
              <p className="font-medium">{exp.description}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{exp.accountPlanName || exp.accountPlan}</span>
                {exp.supplier && (
                  <>
                    <span className="opacity-30">•</span>
                    <span className="font-medium text-primary/80">{exp.supplier}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-tight', cfg.className)}>
                {cfg.label}
              </span>
              <div className="text-right min-w-[100px]">
                <p className="font-mono font-bold text-rose-500">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(exp.totalValue)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {due ? format(due, 'dd/MM/yyyy') : 'Sem data'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
