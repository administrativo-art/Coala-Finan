'use client';

import { useState, useMemo } from 'react';
import { collection, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isPast, isWithinInterval, addDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { PayExpenseDialog } from '@/components/pay-expense-dialog';
import {
  MoreHorizontal, XCircle, Pencil, Trash2,
  Search, Download, AlertTriangle, Clock, CircleDollarSign, Filter, Receipt, ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Helpers ────────────────────────────────────────────────────────────────

const toDate = (ts: any): Date | null => {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof ts?.toDate === 'function') return ts.toDate();
  return new Date(ts);
};

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid: { label: 'Pago', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  overdue: { label: 'Vencido', className: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  pending: { label: 'Em aberto', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  due_soon: { label: 'Vence hoje', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
};

const cancelSchema = z.object({
  reason: z.string().min(5, 'Informe o motivo com pelo menos 5 caracteres.'),
});
type CancelValues = z.infer<typeof cancelSchema>;

export default function ExpensesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const expensesRef = useMemo(() => (firestore ? collection(firestore, 'expenses') : null), [firestore]);
  const { data: expenses = [], loading } = useCollection<any>(expensesRef);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const cancelForm = useForm<CancelValues>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: '' },
  });

  const filtered = useMemo(() => {
    const now = startOfDay(new Date());
    return expenses.filter(e => {
      const matchSearch = !search || 
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        (e.accountPlanName || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.supplier || '').toLowerCase().includes(search.toLowerCase());

      const due = toDate(e.dueDate);
      let computedStatus = e.status;
      if (e.status === 'pending' && due) {
        if (isPast(due) && due < now) computedStatus = 'overdue';
        else if (format(due, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) computedStatus = 'due_soon';
      }

      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'overdue' && computedStatus === 'overdue') ||
        (statusFilter === 'pending' && (computedStatus === 'pending' || computedStatus === 'due_soon' || computedStatus === 'overdue')) ||
        computedStatus === statusFilter;

      return matchSearch && matchStatus;
    }).sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
  }, [expenses, search, statusFilter]);

  const totals = useMemo(() => {
    const now = startOfDay(new Date());
    return expenses.reduce((acc, e) => {
      const due = toDate(e.dueDate);
      if (e.status === 'pending') {
        acc.pending += e.totalValue || 0;
        if (due && due < now) acc.overdue += e.totalValue || 0;
      } else if (e.status === 'paid') {
        acc.paid += e.totalValue || 0;
      }
      return acc;
    }, { pending: 0, overdue: 0, paid: 0 });
  }, [expenses]);

  async function handleCancel(values: CancelValues) {
    if (!firestore || !cancelTarget) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'expenses', cancelTarget.id), {
        status: 'cancelled',
        cancelReason: values.reason,
        cancelledAt: Timestamp.now(),
      });
      toast({ title: 'Despesa cancelada com sucesso.' });
      setCancelTarget(null);
      cancelForm.reset();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao cancelar despesa.' });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDelete() {
    if (!firestore || !deleteTarget) return;
    try {
      await deleteDoc(doc(firestore, 'expenses', deleteTarget.id));
      toast({ title: 'Despesa excluída permanentemente.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao excluir despesa.' });
    } finally {
      setDeleteTarget(null);
    }
  }

  const exportCSV = () => {
    const header = 'Descrição,Conta,Fornecedor,Valor,Vencimento,Status\n';
    const rows = filtered.map(e => [
      `"${e.description}"`, `"${e.accountPlanName || e.accountPlan}"`, `"${e.supplier || ''}"`,
      (e.totalValue || 0).toFixed(2), toDate(e.dueDate) ? format(toDate(e.dueDate)!, 'dd/MM/yyyy') : '', e.status
    ].join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `despesas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Painel de despesas</h1>
          <p className="text-muted-foreground">Gerencie todos os lançamentos e provisões do sistema.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" onClick={() => router.push('/dashboard/new-expense')}>
            <Receipt className="mr-2 h-4 w-4" /> Novo lançamento
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em aberto</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{formatCurrency(totals.pending)}</div>
          </CardContent>
        </Card>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">{formatCurrency(totals.overdue)}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total pago</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(totals.paid)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por descrição ou fornecedor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4 opacity-50" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Em aberto</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Descrição / Fornecedor</th>
                  <th className="px-4 py-3 text-left font-medium">Plano de contas</th>
                  <th className="px-4 py-3 text-left font-medium">Vencimento</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={6} className="p-4"><Skeleton className="h-10 w-full" /></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center text-muted-foreground">Nenhuma despesa encontrada.</td></tr>
                ) : (
                  filtered.map(exp => {
                    const due = toDate(exp.dueDate);
                    const now = startOfDay(new Date());
                    let statusKey = exp.status;
                    if (exp.status === 'pending' && due) {
                      if (due < now) statusKey = 'overdue';
                      else if (format(due, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) statusKey = 'due_soon';
                    }
                    const cfg = STATUS_CONFIG[statusKey] || { label: exp.status, className: '' };

                    return (
                      <tr key={exp.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{exp.description}</div>
                          <div className="text-xs text-muted-foreground">{exp.supplier || 'Sem fornecedor'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{exp.accountPlanName || exp.accountPlan}</td>
                        <td className="px-4 py-3">
                          <div className={cn(statusKey === 'overdue' && 'text-rose-500 font-bold', statusKey === 'due_soon' && 'text-amber-500 font-bold')}>
                            {due ? format(due, 'dd/MM/yyyy') : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(exp.totalValue)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-tight', cfg.className)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {exp.status === 'pending' && (
                                <DropdownMenuItem onClick={() => setPayTarget(exp)} className="text-emerald-500 focus:text-emerald-600">
                                  <CircleDollarSign className="mr-2 h-4 w-4" /> Pagar agora
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => router.push(`/dashboard/new-expense?edit=${exp.id}`)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              {exp.status === 'pending' && (
                                <DropdownMenuItem onClick={() => setCancelTarget(exp)} className="text-amber-500 focus:text-amber-600">
                                  <XCircle className="mr-2 h-4 w-4" /> Cancelar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteTarget(exp)} className="text-rose-500 focus:text-rose-600">
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir permanentemente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PayExpenseDialog expense={payTarget} open={!!payTarget} onOpenChange={open => !open && setPayTarget(null)} />

      <Dialog open={!!cancelTarget} onOpenChange={open => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar despesa</DialogTitle>
            <DialogDescription>Informe por que você está cancelando este lançamento.</DialogDescription>
          </DialogHeader>
          <Form {...cancelForm}>
            <form onSubmit={cancelForm.handleSubmit(handleCancel)} className="space-y-4">
              <FormField control={cancelForm.control} name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo</FormLabel>
                    <FormControl><Textarea placeholder="Ex: duplicidade, erro no valor..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
                <Button type="submit" variant="destructive" disabled={isProcessing}>Confirmar cancelamento</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação removerá a despesa do banco de dados e não poderá ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}