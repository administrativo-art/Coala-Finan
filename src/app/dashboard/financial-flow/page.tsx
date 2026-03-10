'use client';

import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, LayoutDashboard, TrendingDown, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  paid:    'Pago',
  overdue: 'Vencido',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-600',
  paid:    'bg-emerald-500/20 text-emerald-600',
  overdue: 'bg-rose-500/20 text-rose-600',
};

export default function FinancialFlowPage() {
  const firestore = useFirestore();
  const ref = useMemo(() => (firestore ? collection(firestore, 'expenses') : null), [firestore]);
  const { data: expenses, loading } = useCollection(ref);

  const [monthsBack, setMonthsBack] = useState('3');

  const { chartData, filtered } = useMemo(() => {
    if (!expenses) return { chartData: [], filtered: [] };

    const months = parseInt(monthsBack);
    const start = startOfMonth(subMonths(new Date(), months - 1));
    const end = endOfMonth(new Date());

    const filtered = expenses.filter(e => {
      if (!e.competenceDate) return false;
      const d = e.competenceDate.toDate ? e.competenceDate.toDate() : new Date(e.competenceDate);
      return isAfter(d, start) && isBefore(d, end);
    });

    // Group by month for chart
    const byMonth: Record<string, { month: string; rawDate: Date; expenses: number; paid: number }> = {};

    filtered.forEach(e => {
      const d = e.competenceDate.toDate ? e.competenceDate.toDate() : new Date(e.competenceDate);
      const key = format(d, 'MMM/yy', { locale: ptBR });
      if (!byMonth[key]) {
        byMonth[key] = { month: key, rawDate: startOfMonth(d), expenses: 0, paid: 0 };
      }
      byMonth[key].expenses += e.totalValue ?? 0;
      if (e.status === 'paid') byMonth[key].paid += e.totalValue ?? 0;
    });

    const chartData = Object.values(byMonth).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    return { chartData, filtered };
  }, [expenses, monthsBack]);

  function exportCSV() {
    if (!filtered.length) return;
    const header = 'Descrição,Plano de Contas,Valor,Competência,Vencimento,Status\n';
    const rows = filtered.map(e => {
      const comp = e.competenceDate?.toDate ? e.competenceDate.toDate() : new Date(e.competenceDate || 0);
      const due  = e.dueDate?.toDate ? e.dueDate.toDate() : new Date(e.dueDate || 0);
      return [
        `"${e.description.replace(/"/g, '""')}"`,
        `"${(e.accountPlanName || e.accountPlan || '').replace(/"/g, '""')}"`,
        e.totalValue,
        format(comp, 'dd/MM/yyyy'),
        format(due, 'dd/MM/yyyy'),
        STATUS_LABELS[e.status] ?? e.status,
      ].join(',');
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `fluxo-financeiro-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Fluxo Financeiro</h1>
          <p className="text-muted-foreground text-sm">Acompanhe as movimentações financeiras no período.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={monthsBack} onValueChange={setMonthsBack}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Este mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-rose-500" />
              Saídas Provisionadas vs Pagas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : chartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                Nenhum dado no período selecionado.
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      fontSize={12}
                      tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)}
                    />
                    <Legend iconType="circle" />
                    <Bar dataKey="expenses" name="Provisionado" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="Pago" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Resumo do Período</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Provisionado</p>
              <p className="text-3xl font-bold text-rose-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  filtered.reduce((acc, curr) => acc + (curr.totalValue || 0), 0)
                )}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Pago</p>
              <p className="text-3xl font-bold text-emerald-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  filtered.filter(e => e.status === 'paid').reduce((acc, curr) => acc + (curr.totalValue || 0), 0)
                )}
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Eficiência de Pagamento</p>
              <div className="flex items-center gap-4">
                <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all" 
                    style={{ 
                      width: `${filtered.length > 0 ? (filtered.filter(e => e.status === 'paid').length / filtered.length) * 100 : 0}%` 
                    }} 
                  />
                </div>
                <span className="text-sm font-medium">
                  {filtered.length > 0 ? Math.round((filtered.filter(e => e.status === 'paid').length / filtered.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg flex items-center justify-between">
            <span>Transações ({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <ScrollArea className="h-[400px] w-full">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[300px]">Descrição</TableHead>
                    <TableHead>Plano de Contas</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhuma transação no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...filtered]
                      .sort((a, b) => {
                        const dateA = a.competenceDate?.toDate ? a.competenceDate.toDate() : new Date(a.competenceDate || 0);
                        const dateB = b.competenceDate?.toDate ? b.competenceDate.toDate() : new Date(b.competenceDate || 0);
                        return dateB.getTime() - dateA.getTime();
                      })
                      .map(exp => {
                        const comp = exp.competenceDate?.toDate ? exp.competenceDate.toDate() : new Date(exp.competenceDate || 0);
                        const due  = exp.dueDate?.toDate ? exp.dueDate.toDate() : new Date(exp.dueDate || 0);
                        return (
                          <TableRow key={exp.id}>
                            <TableCell className="font-medium">{exp.description}</TableCell>
                            <TableCell className="text-muted-foreground">{exp.accountPlanName || exp.accountPlan}</TableCell>
                            <TableCell>{format(comp, 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{format(due,  'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-right font-semibold text-rose-500">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(exp.totalValue)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={cn('font-medium', STATUS_COLORS[exp.status] ?? '')}>
                                {STATUS_LABELS[exp.status] ?? exp.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
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