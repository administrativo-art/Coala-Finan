'use client';

import { useState, useMemo } from 'react';
import { collection, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Download, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Calendar as CalendarIcon,
  Filter
} from 'lucide-react';
import { format, subMonths, isWithinInterval, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Helper para converter Timestamp ou data string para Date
const toDate = (dateAny: any): Date | null => {
  if (!dateAny) return null;
  if (dateAny instanceof Timestamp) return dateAny.toDate();
  if (typeof dateAny?.toDate === 'function') return dateAny.toDate();
  return new Date(dateAny);
};

const PERIOD_OPTIONS = [
  { label: 'Último mês', value: '1' },
  { label: 'Últimos 3 meses', value: '3' },
  { label: 'Últimos 6 meses', value: '6' },
  { label: 'Últimos 12 meses', value: '12' },
];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  paid: { label: 'Pago', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
};

export default function FinancialFlowPage() {
  const firestore = useFirestore();
  const [monthsBack, setMonthsBack] = useState('6');
  const [statusFilter, setStatusFilter] = useState('all');

  const expensesRef = useMemo(() => (firestore ? collection(firestore, 'expenses') : null), [firestore]);
  const { data: expenses, loading } = useCollection(expensesRef);

  // Lógica de filtragem e agrupamento
  const { filtered, chartData, totals } = useMemo(() => {
    if (!expenses) return { filtered: [], chartData: [], totals: { pending: 0, paid: 0 } };

    const periodMonths = parseInt(monthsBack);
    const start = startOfMonth(subMonths(new Date(), periodMonths - 1));
    const end = endOfMonth(new Date());

    // 1. Filtrar despesas no período
    const inPeriod = expenses.filter(e => {
      const date = toDate(e.competenceDate) || toDate(e.dueDate);
      if (!date) return false;
      return isAfter(date, start) && isBefore(date, end);
    });

    // 2. Aplicar filtro de status para a tabela
    const filteredForTable = inPeriod.filter(e => statusFilter === 'all' || e.status === statusFilter);

    // 3. Agrupar por mês para o gráfico (Provisionado vs Pago)
    const monthsMap: Record<string, { month: string; rawDate: Date; expenses: number; paid: number }> = {};

    // Inicializa todos os meses do período (mesmo os vazios)
    for (let i = 0; i < periodMonths; i++) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'MMM/yy', { locale: ptBR });
      monthsMap[key] = { month: key, rawDate: startOfMonth(d), expenses: 0, paid: 0 };
    }

    inPeriod.forEach(e => {
      const date = toDate(e.competenceDate) || toDate(e.dueDate);
      if (!date) return;
      const key = format(date, 'MMM/yy', { locale: ptBR });
      if (monthsMap[key]) {
        monthsMap[key].expenses += e.totalValue || 0;
        if (e.status === 'paid') {
          monthsMap[key].paid += e.totalValue || 0;
        }
      }
    });

    const chartDataSorted = Object.values(monthsMap).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    // 4. Calcular Totais
    const totalPending = inPeriod
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + (e.totalValue || 0), 0);
    const totalPaid = inPeriod
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + (e.totalValue || 0), 0);

    return { 
      filtered: filteredForTable, 
      chartData: chartDataSorted, 
      totals: { pending: totalPending, paid: totalPaid } 
    };
  }, [expenses, monthsBack, statusFilter]);

  const exportCSV = () => {
    if (!filtered.length) return;
    const header = 'Descrição,Plano de contas,Valor,Competência,Vencimento,Status\n';
    const rows = filtered.map(e => {
      const comp = toDate(e.competenceDate);
      const due = toDate(e.dueDate);
      return [
        `"${e.description.replace(/"/g, '""')}"`,
        `"${(e.accountPlanName || e.accountPlan || '').replace(/"/g, '""')}"`,
        (e.totalValue || 0).toFixed(2),
        comp ? format(comp, 'dd/MM/yyyy') : '',
        due ? format(due, 'dd/MM/yyyy') : '',
        STATUS_CONFIG[e.status]?.label || e.status,
      ].join(',');
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxo-financeiro-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Fluxo financeiro</h1>
          <p className="text-muted-foreground">Análise de movimentações provisionadas e liquidadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={monthsBack} onValueChange={setMonthsBack}>
            <SelectTrigger className="w-[180px]">
              <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total em aberto</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{formatCurrency(totals.pending)}</div>
            <p className="text-xs text-muted-foreground mt-1">Compromissos futuros</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total pago</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(totals.paid)}</div>
            <p className="text-xs text-muted-foreground mt-1">Liquidados no período</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fluxo total</CardTitle>
            <TrendingDown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.pending + totals.paid)}</div>
            <p className="text-xs text-muted-foreground mt-1">Volume financeiro total</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-headline">Saídas: provisionado vs pago</CardTitle>
            <CardDescription>Comparativo mensal de despesas lançadas e pagas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed text-muted-foreground">
                  Sem dados para o gráfico no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis 
                      dataKey="month" 
                      tickLine={false} 
                      axisLine={false} 
                      fontSize={12} 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      fontSize={12}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="expenses" name="Provisionado" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="Pago" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-headline">Filtros</CardTitle>
            <CardDescription>Refine a listagem de despesas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status do pagamento</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4 opacity-50" />
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Somente pendentes</SelectItem>
                  <SelectItem value="paid">Somente pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Itens no período</span>
                <span className="font-bold">{filtered.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Eficiência (pagos)</span>
                <span className="font-bold text-emerald-500">
                  {filtered.length > 0 ? Math.round((filtered.filter(e => e.status === 'paid').length / filtered.length) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${filtered.length > 0 ? (filtered.filter(e => e.status === 'paid').length / filtered.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-headline">Lançamentos detalhados</CardTitle>
            <CardDescription>Lista completa de despesas e provisões filtradas.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ScrollArea className="h-[450px]">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="w-[300px]">Descrição</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhuma transação encontrada para este filtro.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...filtered]
                      .sort((a, b) => {
                        const dateA = toDate(a.competenceDate) || new Date(0);
                        const dateB = toDate(b.competenceDate) || new Date(0);
                        return dateB.getTime() - dateA.getTime();
                      })
                      .map(exp => (
                        <TableRow key={exp.id}>
                          <TableCell className="font-medium">{exp.description}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {exp.accountPlanName || exp.accountPlan}
                          </TableCell>
                          <TableCell className="text-xs">
                            {toDate(exp.competenceDate) ? format(toDate(exp.competenceDate)!, 'dd/MM/yyyy') : '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {toDate(exp.dueDate) ? format(toDate(exp.dueDate)!, 'dd/MM/yyyy') : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-rose-500">
                            {formatCurrency(exp.totalValue)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn('font-medium shadow-sm', STATUS_CONFIG[exp.status]?.className)}>
                              {STATUS_CONFIG[exp.status]?.label || exp.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
