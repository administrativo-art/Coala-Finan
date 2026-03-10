
'use client';

import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, TrendingUp, ArrowLeftRight, SlidersHorizontal } from 'lucide-react';

import type { Account } from '@/types/account';
import { REVENUE_CATEGORY_LABELS } from '@/types/transaction';

const baseSchema = z.object({
  accountId:          z.string().min(1, 'Selecione uma conta.'),
  paymentMethodId:    z.string().min(1, 'Selecione a forma de pagamento.'),
  amount:             z.coerce.number().positive('Informe um valor maior que zero.'),
  date:               z.date({ required_error: 'Informe a data.' }),
  description:        z.string().min(3, 'Informe uma descrição.'),
  notes:              z.string().optional(),
});

const revenueSchema = baseSchema.extend({
  revenueCategory: z.string().min(1, 'Selecione a categoria.'),
  revenueSource:   z.string().optional(),
  isRecurring:     z.boolean().default(false),
  recurringDay:    z.coerce.number().min(1).max(31).optional(),
});

const transferSchema = z.object({
  fromAccountId:       z.string().min(1, 'Selecione a conta de origem.'),
  fromPaymentMethodId: z.string().min(1, 'Selecione a forma de pagamento.'),
  toAccountId:         z.string().min(1, 'Selecione a conta de destino.'),
  toPaymentMethodId:   z.string().min(1, 'Selecione a forma de pagamento.'),
  amount:              z.coerce.number().positive('Informe um valor maior que zero.'),
  date:                z.date({ required_error: 'Informe a data.' }),
  description:         z.string().min(3, 'Informe uma descrição.'),
  notes:               z.string().optional(),
}).refine(d => d.fromAccountId !== d.toAccountId, {
  message: 'Origem e destino não podem ser a mesma conta.',
  path: ['toAccountId'],
});

const adjustmentSchema = baseSchema.extend({
  direction: z.enum(['in', 'out']),
  reason:    z.string().min(5, 'Descreva o motivo do ajuste.'),
});

type RevenueValues    = z.infer<typeof revenueSchema>;
type TransferValues   = z.infer<typeof transferSchema>;
type AdjustmentValues = z.infer<typeof adjustmentSchema>;

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  pix: 'PIX',
  transfer: 'Transferência',
  cash: 'Dinheiro',
};

export function NewTransactionDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess?: () => void }) {
  const firestore = useFirestore();
  const { user }  = useUser();
  const { toast } = useToast();
  const [tab,      setTab]      = useState<'revenue' | 'transfer' | 'adjustment'>('revenue');
  const [isSaving, setIsSaving] = useState(false);

  const accountsRef = firestore ? collection(firestore, 'bankAccounts') : null;
  const { data: accountsData } = useCollection<Account>(accountsRef);
  const accounts = accountsData || [];
  const activeAccounts = accounts.filter(a => a.active);

  const revenueForm = useForm<RevenueValues>({
    resolver: zodResolver(revenueSchema),
    defaultValues: { date: new Date(), isRecurring: false, notes: '', revenueSource: '' },
  });

  const transferForm = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { date: new Date(), notes: '' },
  });

  const adjustmentForm = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { date: new Date(), direction: 'in', notes: '' },
  });

  function getMethodsForAccount(accountId: string) {
    return activeAccounts.find(a => a.id === accountId)?.paymentMethods ?? [];
  }

  function getAccountName(accountId: string) {
    return activeAccounts.find(a => a.id === accountId)?.name ?? '';
  }

  function getMethodLabel(accountId: string, methodId: string) {
    const method = getMethodsForAccount(accountId).find(m => m.id === methodId);
    if (!method) return '';
    return `${method.label}`;
  }

  async function submitRevenue(values: RevenueValues) {
    if (!firestore || !user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'transactions'), {
        type: values.isRecurring ? 'revenue_recurring' : 'revenue',
        direction: 'in',
        accountId: values.accountId,
        accountName: getAccountName(values.accountId),
        paymentMethodId: values.paymentMethodId,
        paymentMethodLabel: getMethodLabel(values.accountId, values.paymentMethodId),
        amount: values.amount,
        date: Timestamp.fromDate(values.date),
        description: values.description,
        revenueCategory: values.revenueCategory,
        revenueSource: values.revenueSource ?? '',
        isRecurring: values.isRecurring,
        recurringDay: values.isRecurring ? values.recurringDay : null,
        notes: values.notes ?? '',
        createdBy: user.uid,
        createdAt: Timestamp.now(),
      });
      toast({ title: 'Receita registrada com sucesso!' });
      revenueForm.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch { toast({ variant: 'destructive', title: 'Erro ao salvar receita.' }); }
    finally { setIsSaving(false); }
  }

  async function submitTransfer(values: TransferValues) {
    if (!firestore || !user) return;
    setIsSaving(true);
    try {
      const txCollection = collection(firestore, 'transactions');
      const now = Timestamp.now();
      const date = Timestamp.fromDate(values.date);

      await Promise.all([
        addDoc(txCollection, {
          type: 'transfer_out',
          direction: 'out',
          accountId: values.fromAccountId,
          accountName: getAccountName(values.fromAccountId),
          paymentMethodId: values.fromPaymentMethodId,
          paymentMethodLabel: getMethodLabel(values.fromAccountId, values.fromPaymentMethodId),
          toAccountId: values.toAccountId,
          toAccountName: getAccountName(values.toAccountId),
          amount: values.amount,
          date,
          description: values.description,
          notes: values.notes ?? '',
          createdBy: user.uid,
          createdAt: now,
        }),
        addDoc(txCollection, {
          type: 'transfer_in',
          direction: 'in',
          accountId: values.toAccountId,
          accountName: getAccountName(values.toAccountId),
          paymentMethodId: values.toPaymentMethodId,
          paymentMethodLabel: getMethodLabel(values.toAccountId, values.toPaymentMethodId),
          toAccountId: values.fromAccountId,
          toAccountName: getAccountName(values.fromAccountId),
          amount: values.amount,
          date,
          description: values.description,
          notes: values.notes ?? '',
          createdBy: user.uid,
          createdAt: now,
        })
      ]);

      toast({ title: 'Transferência registrada!' });
      transferForm.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch { toast({ variant: 'destructive', title: 'Erro ao registrar transferência.' }); }
    finally { setIsSaving(false); }
  }

  async function submitAdjustment(values: AdjustmentValues) {
    if (!firestore || !user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'transactions'), {
        type: 'adjustment',
        direction: values.direction,
        accountId: values.accountId,
        accountName: getAccountName(values.accountId),
        paymentMethodId: values.paymentMethodId,
        paymentMethodLabel: getMethodLabel(values.accountId, values.paymentMethodId),
        amount: values.amount,
        date: Timestamp.fromDate(values.date),
        description: values.description,
        notes: values.reason,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
      });
      toast({ title: 'Ajuste de saldo registrado!' });
      adjustmentForm.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch { toast({ variant: 'destructive', title: 'Erro ao salvar ajuste.' }); }
    finally { setIsSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Registre uma receita, transferência ou ajuste de saldo.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="revenue" className="flex-1 gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /> Receita</TabsTrigger>
            <TabsTrigger value="transfer" className="flex-1 gap-1.5 text-xs"><ArrowLeftRight className="h-3.5 w-3.5" /> Transferência</TabsTrigger>
            <TabsTrigger value="adjustment" className="flex-1 gap-1.5 text-xs"><SlidersHorizontal className="h-3.5 w-3.5" /> Ajuste</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="mt-4">
            <Form {...revenueForm}>
              <form onSubmit={revenueForm.handleSubmit(submitRevenue)} className="space-y-4">
                <AccountSelector form={revenueForm} accounts={activeAccounts} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={revenueForm.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Valor (R$)</FormLabel><FormControl><Input type="number" step="0.01" className="h-9 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <DateField form={revenueForm} name="date" />
                </div>
                <FormField control={revenueForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Descrição</FormLabel><FormControl><Input className="h-9 text-xs" placeholder="Ex: Recebimento cliente X" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={revenueForm.control} name="revenueCategory" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Categoria</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{Object.entries(REVENUE_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={revenueForm.control} name="revenueSource" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Origem (opcional)</FormLabel><FormControl><Input className="h-9 text-xs" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={revenueForm.control} name="isRecurring" render={({ field }) => (
                  <FormItem className="flex items-center gap-3"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0 text-xs">Receita recorrente</FormLabel></FormItem>
                )} />
                <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar receita</Button></DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="transfer" className="mt-4">
            <Form {...transferForm}>
              <form onSubmit={transferForm.handleSubmit(submitTransfer)} className="space-y-4">
                <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Origem</p>
                  <AccountSelector form={transferForm} accounts={activeAccounts} accName="fromAccountId" methName="fromPaymentMethodId" />
                </div>
                <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Destino</p>
                  <AccountSelector form={transferForm} accounts={activeAccounts} accName="toAccountId" methName="toPaymentMethodId" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={transferForm.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Valor (R$)</FormLabel><FormControl><Input type="number" step="0.01" className="h-9 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <DateField form={transferForm} name="date" />
                </div>
                <FormField control={transferForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Descrição</FormLabel><FormControl><Input className="h-9 text-xs" placeholder="Ex: Transferência entre contas" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar transferência</Button></DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="adjustment" className="mt-4">
            <Form {...adjustmentForm}>
              <form onSubmit={adjustmentForm.handleSubmit(submitAdjustment)} className="space-y-4">
                <AccountSelector form={adjustmentForm} accounts={activeAccounts} />
                <div className="grid grid-cols-3 gap-3">
                  <FormField control={adjustmentForm.control} name="direction" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Tipo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="in" className="text-xs">Entrada (+)</SelectItem><SelectItem value="out" className="text-xs">Saída (-)</SelectItem></SelectContent></Select></FormItem>
                  )} />
                  <FormField control={adjustmentForm.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Valor (R$)</FormLabel><FormControl><Input type="number" step="0.01" className="h-9 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <DateField form={adjustmentForm} name="date" />
                </div>
                <FormField control={adjustmentForm.control} name="reason" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Motivo do ajuste</FormLabel><FormControl><Textarea className="text-xs" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar ajuste</Button></DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AccountSelector({ form, accounts, accName = 'accountId', methName = 'paymentMethodId' }: { form: any; accounts: Account[]; accName?: string; methName?: string }) {
  const accountId = form.watch(accName);
  const account = accounts.find(a => a.id === accountId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField control={form.control} name={accName} render={({ field }) => (
        <FormItem><FormLabel className="text-xs">Conta</FormLabel><Select onValueChange={val => { field.onChange(val); form.setValue(methName, ''); }} value={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name={methName} render={({ field }) => (
        <FormItem><FormLabel className="text-xs">Instrumento</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!accountId}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{account?.paymentMethods.map(pm => <SelectItem key={pm.id} value={pm.id} className="text-xs">{pm.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
      )} />
    </div>
  );
}

function DateField({ form, name }: { form: any; name: string }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex flex-col"><FormLabel className="text-xs">Data</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn('h-9 pl-3 text-left text-xs font-normal', !field.value && 'text-muted-foreground')}>{field.value ? format(field.value, "dd/MM/yyyy") : 'Selecione'}<CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} /></PopoverContent></Popover><FormMessage /></FormItem>
    )} />
  );
}
