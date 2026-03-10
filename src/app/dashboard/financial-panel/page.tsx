'use client';

import { useState, useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import {
  format, subMonths, startOfMonth, endOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, BarChart2, Download,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(ts: Timestamp | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof (ts as any)?.toDate === 'function') return (ts as any).toDate();
  return new Date(ts as any);
}

function fmt(value: number, compact = false) {
  if (compact) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', notation: 'compact',
    }).format(value);
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

const CHART_COLORS = [
  '#38bdf8', '#34d399', '#f472b6', '#fb923c',
  '#a78bfa', '#facc15', '#f87171', '#2dd4bf',
];

// ─── Componente principal ────────────────────────────────────────────────────

export default function FinancialPanelPage() {
  const firestore = useFirestore();

  const expensesRef = useMemo(() => (firestore ? collection(firestore, 'expenses') : null), [firestore]);
  const transactionsRef = useMemo(() => (firestore ? collection(firestore, 'transactions') : null), [firestore]);
  const paymentsRef = useMemo(() => (firestore ? collection(firestore, 'payments') : null), [firestore]);

  const { data: expenses = [], loading: le } = useCollection<any>(expensesRef);
  const { data: transactions = [], loading: lt } = useCollection<any>(transactionsRef);
  const { data: payments = [], loading: lp } = useCollection<any>(paymentsRef);

  const loading = le || lt || lp;

  const [period, setPeriod] = useState<string>('6');

  const months = parseInt(period);
  const periodStart = startOfMonth(subMonths(new Date(), months - 1));
  const periodEnd = endOfMonth(new Date());

  // ── Receitas do período (transactions direction=in, exceto transfer_in) ──
  const revenues = useMemo(() =>
    transactions.filter(tx => {
      const d = toDate(tx.date);
      if (!d || d < periodStart || d > periodEnd) return false;
      return tx.direction === 'in' && tx.type !== 'transfer_in';
    })
  , [transactions, periodStart, periodEnd]);

  // ── Despesas pagas no período (payments) ──
  const paidExpenses = useMemo(() =>
    payments.filter(p => {
      const d = toDate(p.paidAt);
      return d && d >= periodStart && d <= periodEnd;
    })
  , [payments, periodStart, periodEnd]);

  // ── Despesas provisionadas no período (expenses por competência) ──
  const provisionedExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = toDate(e.competenceDate);
      return d && d >= periodStart && d <= periodEnd;
    })
  , [expenses, periodStart, periodEnd]);

  // ── Totalizadores ──
  const totalRevenue = useMemo(() => revenues.reduce((s, t) => s + (t.amount ?? 0), 0), [revenues]);
  const totalPaid = useMemo(() => paidExpenses.reduce((s, p) => s + (p.totalPaid ?? 0), 0), [paidExpenses]);
  const totalProvisioned = useMemo(() => provisionedExpenses.reduce((s, e) => s + (e.totalValue ?? 0), 0), [provisionedExpenses]);
  const dreResult = totalRevenue - totalPaid;
  const dreMargin = totalRevenue > 0 ? (dreResult / totalRevenue) * 100 : 0;

  // ── Dados mensais para gráficos ──
  const monthlyData = useMemo(() => {
    const map: Record<string, { mes: string; receitas: number; despesas: number; resultado: number }> = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      map[key] = { mes: format(d, 'MMM/yy', { locale: ptBR }), receitas: 0, despesas: 0, resultado: 0 };
    }
    revenues.forEach(tx => {
      const d = toDate(tx.date);
      if (!d) return;
      const key = format(d, 'yyyy-MM');
      if (map[key]) map[key].receitas += tx.amount ?? 0;
    });
    paidExpenses.forEach(p => {
      const d = toDate(p.paidAt);
      if (!d) return;
      const key = format(d, 'yyyy-MM');
      if (map[key]) map[key].despesas += p.totalPaid ?? 0;
    });
    Object.values(map).forEach(m => { m.resultado = m.receitas - m.despesas; });
    return Object.values(map);
  }, [revenues, paidExpenses, months]);

  // ── Despesas por centro de custo ──
  const byCostCenter = useMemo(() => {
    const map: Record<string, number> = {};
    provisionedExpenses.forEach(e => {
      const cc = e.accountPlanName || e.accountPlan || 'Sem classificação';
      map[cc] = (map[cc] ?? 0) + (e.totalValue ?? 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [provisionedExpenses]);

  // ── Despesas por centro de resultado ──
  const byResultCenter = useMemo(() => {
    const map: Record<string, number> = {};
    provisionedExpenses.forEach(e => {
      if (e.isApportioned && e.apportionments?.length) {
        e.apportionments.forEach((ap: any) => {
          const rc = ap.resultCenter ?? 'Sem centro de resultado';
          const val = (e.totalValue ?? 0) * (ap.percentage ?? 0) / 100;
          map[rc] = (map[rc] ?? 0) + val;
        });
      } else {
        const rc = e.resultCenter ?? 'Sem centro de resultado';
        map[rc] = (map[rc] ?? 0) + (e.totalValue ?? 0);
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [provisionedExpenses]);

  // ── Receitas por categoria ──
  const byRevenueCategory = useMemo(() => {
    const LABELS: Record<string, string> = {
      sale: 'Venda / serviço', subscription: 'Mensalidade',
      refund: 'Devolução', investment_return: 'Rendimento', other: 'Outro',
    };
    const map: Record<string, number> = {};
    revenues.forEach(tx => {
      const cat = LABELS[tx.revenueCategory ?? 'other'] ?? 'Outro';
      map[cat] = (map[cat] ?? 0) + (tx.amount ?? 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [revenues]);

  // ── Indicador de tendência vs período anterior ──
  const prevStart = startOfMonth(subMonths(periodStart, months));
  const prevEnd = endOfMonth(subMonths(periodEnd, 1));

  const prevRevenue = useMemo(() =>
    transactions
      .filter(tx => {
        const d = toDate(tx.date);
        return d && d >= prevStart && d <= prevEnd && tx.direction === 'in' && tx.type !== 'transfer_in';
      })
      .reduce((s, t) => s + (t.amount ?? 0), 0)
  , [transactions, prevStart, prevEnd]);

  const prevPaid = useMemo(() =>
    payments
      .filter(p => {
        const d = toDate(p.paidAt);
        return d && d >= prevStart && d <= prevEnd;
      })
      .reduce((s, p) => s + (p.totalPaid ?? 0), 0)
  , [payments, prevStart, prevEnd]);

  function Trend({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
    if (previous === 0) return null;
    const diff = ((current - previous) / previous) * 100;
    const positive = invert ? diff < 0 : diff > 0;
    return (
      <span className={cn('flex items-center gap-0.5 text-xs', positive ? 'text-emerald-400' : 'text-rose-400')}>
        {diff > 0
          ? <ArrowUpRight className="h-3 w-3" />
          : diff < 0
          ? <ArrowDownRight className="h-3 w-3" />
          : <Minus className="h-3 w-3" />
        }
        {Math.abs(diff).toFixed(1)}% vs período anterior
      </span>
    );
  }

  // ── Export CSV ──
  function exportDRE() {
    const rows = [
      ['DRE — Demonstrativo de resultado'],
      ['Período', `${format(periodStart, 'MMM/yyyy', { locale: ptBR })} a ${format(periodEnd, 'MMM/yyyy', { locale: ptBR })}`],
      [],
      ['', 'Valor', '% da receita'],
      ['(+) Receitas brutas', fmt(totalRevenue), '100%'],
      ['(-) Despesas pagas', fmt(totalPaid), pct(totalPaid, totalRevenue)],
      ['(=) Resultado líquido', fmt(dreResult), pct(dreResult, totalRevenue)],
      [],
      ['Detalhamento de despesas por plano de contas'],
      ...byCostCenter.map(r => [r.name, fmt(r.value), pct(r.value, totalProvisioned)]),
    ];
    const csv = rows.map(r => r.map(c => `"${c ?? ''}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dre-${format(new Date(), 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Painel financeiro</h1>
          <p className="text-muted-foreground">Visão consolidada de receitas, despesas e resultado.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportDRE}>
            <Download className="mr-2 h-4 w-4" />
            Exportar DRE
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Receitas', value: totalRevenue, prev: prevRevenue, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10', invert: false },
          { label: 'Despesas pagas', value: totalPaid, prev: prevPaid, icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-400/10', invert: true },
          { label: 'Provisões', value: totalProvisioned, prev: 0, icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-400/10', invert: true },
          { label: 'Resultado (DRE)', value: dreResult, prev: prevRevenue - prevPaid, icon: Wallet, color: dreResult >= 0 ? 'text-emerald-400' : 'text-rose-400', bg: dreResult >= 0 ? 'bg-emerald-400/10' : 'bg-rose-400/10', invert: false },
        ].map(card => (
          <Card key={card.label} className="border-border/50 bg-card/50 shadow-sm backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</CardTitle>
              <div className={cn('rounded-full p-2', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {loading ? <Skeleton className="h-8 w-28" /> : (
                <>
                  <div className={cn('text-2xl font-bold tracking-tight', card.color)}>{fmt(card.value)}</div>
                  {card.prev !== 0 && (
                    <Trend current={card.value} previous={card.prev} invert={card.invert} />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 bg-card/50 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl font-headline">DRE — Demonstrativo de resultado</CardTitle>
          <CardDescription>
            {format(periodStart, 'MMM/yyyy', { locale: ptBR })} a {format(periodEnd, 'MMM/yyyy', { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : (
            <div className="space-y-2 text-sm">
              {[
                { label: '(+) Receitas brutas', value: totalRevenue, pctVal: 100, color: 'text-emerald-400' },
                { label: '(-) Despesas pagas', value: -totalPaid, pctVal: totalPaid / totalRevenue * 100, color: 'text-rose-400' },
                { label: '(=) Resultado líquido', value: dreResult, pctVal: dreMargin, color: dreResult >= 0 ? 'text-emerald-400' : 'text-rose-400', bold: true },
              ].map(row => (
                <div key={row.label} className={cn(
                  'flex items-center justify-between rounded-lg px-4 py-3',
                  row.bold ? 'border border-primary/20 bg-primary/5 font-semibold' : 'border-b border-border/10'
                )}>
                  <span className={row.bold ? 'text-foreground' : 'text-muted-foreground'}>{row.label}</span>
                  <div className="flex items-center gap-6">
                    <span className="w-16 text-right text-xs text-muted-foreground">
                      {totalRevenue > 0 ? `${Math.abs(row.pctVal).toFixed(1)}%` : '—'}
                    </span>
                    <span className={cn('w-32 text-right font-mono text-base', row.color)}>
                      {fmt(row.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="evolution" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="evolution">Evolução</TabsTrigger>
          <TabsTrigger value="cost-center">Plano de contas</TabsTrigger>
          <TabsTrigger value="result-center">Resultado</TabsTrigger>
          <TabsTrigger value="revenue">Receitas</TabsTrigger>
        </TabsList>

        <TabsContent value="evolution" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Evolução mensal</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              {loading ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v, true)} />
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-center" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Distribuição</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCostCenter} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                      {byCostCenter.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ranking por conta</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {byCostCenter.map((item, i) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium truncate mr-2">{item.name}</span>
                      <span className="font-mono font-bold text-rose-400">{fmt(item.value)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full transition-all" style={{ width: pct(item.value, totalProvisioned), backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="result-center" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Por centro de resultado</CardTitle></CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byResultCenter} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]}>
                    {byResultCenter.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Por categoria</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byRevenueCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                      {byRevenueCategory.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ranking de receitas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {byRevenueCategory.map((item, i) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-mono font-bold text-emerald-400">{fmt(item.value)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full transition-all" style={{ width: pct(item.value, totalRevenue), backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
