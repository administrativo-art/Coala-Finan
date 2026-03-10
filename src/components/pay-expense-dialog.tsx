'use client';

import { useState } from 'react';
import { collection, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, CalendarIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Schema ──────────────────────────────────────────────────────────────────

const splitSchema = z.object({
  accountId: z.string().min(1, 'Selecione uma conta.'),
  accountName: z.string(),
  paymentMethodId: z.string().min(1, 'Selecione a forma de pagamento.'),
  paymentMethodLabel: z.string(),
  amount: z.coerce.number().positive('Informe um valor maior que zero.'),
});

const paySchema = z.object({
  paidAt: z.date({ required_error: 'Informe a data do pagamento.' }),
  notes: z.string().optional(),
  splits: z.array(splitSchema).min(1, 'Adicione ao menos uma forma de pagamento.'),
});

type PayFormValues = z.infer<typeof paySchema>;

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  expense: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function PayExpenseDialog({ expense, open, onOpenChange, onSuccess }: Props) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const accountsRef = firestore ? collection(firestore, 'bankAccounts') : null;
  const { data: accountsData } = useCollection<any>(accountsRef);
  const accounts = accountsData || [];
  const activeAccounts = accounts.filter(a => a.active);

  const form = useForm<PayFormValues>({
    resolver: zodResolver(paySchema),
    defaultValues: {
      paidAt: new Date(),
      notes: '',
      splits: [{ accountId: '', accountName: '', paymentMethodId: '', paymentMethodLabel: '', amount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'splits',
  });

  const splits = form.watch('splits');
  const totalPaid = splits.reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
  const remaining = (expense?.totalValue ?? 0) - totalPaid;
  const isExact = Math.abs(remaining) < 0.01;
  const isOver = remaining < -0.01;

  function handleAccountChange(index: number, accountId: string) {
    const account = activeAccounts.find(a => a.id === accountId);
    if (account) {
      form.setValue(`splits.${index}.accountName`, account.name);
      form.setValue(`splits.${index}.paymentMethodId`, '');
      form.setValue(`splits.${index}.paymentMethodLabel`, '');
    }
  }

  function handleMethodChange(index: number, accountId: string, methodId: string) {
    const account = activeAccounts.find(a => a.id === accountId);
    const method = account?.paymentMethods.find((m: any) => m.id === methodId);
    if (method) {
      form.setValue(`splits.${index}.paymentMethodLabel`, `${method.label}`);
    }
  }

  function fillRemaining(index: number) {
    const otherTotal = splits
      .filter((_, i) => i !== index)
      .reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
    const rest = (expense?.totalValue ?? 0) - otherTotal;
    if (rest > 0) form.setValue(`splits.${index}.amount`, parseFloat(rest.toFixed(2)));
  }

  async function onSubmit(values: PayFormValues) {
    if (!firestore || !user || !expense) return;
    if (isOver) {
      toast({ variant: 'destructive', title: 'Valor total excede a despesa.' });
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'payments'), {
        expenseId: expense.id,
        paidAt: Timestamp.fromDate(values.paidAt),
        totalPaid: totalPaid,
        splits: values.splits,
        notes: values.notes ?? '',
        createdBy: user.uid,
        createdAt: Timestamp.now(),
      });

      await updateDoc(doc(firestore, 'expenses', expense.id), {
        status: 'paid',
        paidAt: Timestamp.fromDate(values.paidAt),
      });

      toast({ title: 'Pagamento registrado com sucesso!' });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Erro ao registrar pagamento.' });
    } finally {
      setIsSaving(false);
    }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={open => { onOpenChange(open); if (!open) form.reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Registrar pagamento</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{expense.description}</span>
            <span className="mx-2 opacity-50">|</span>
            <span className="font-bold text-foreground">{formatCurrency(expense.totalValue)}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="paidAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data do pagamento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                          {field.value ? format(field.value, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formas de pagamento</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', accountName: '', paymentMethodId: '', paymentMethodLabel: '', amount: 0 })}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const accountId = form.watch(`splits.${index}.accountId`);
                  const account = activeAccounts.find(a => a.id === accountId);

                  return (
                    <div key={field.id} className="relative rounded-lg border bg-muted/30 p-4 space-y-3">
                      {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-rose-500" onClick={() => remove(index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}

                      <div className="grid grid-cols-2 gap-3 pr-6">
                        <FormField control={form.control} name={`splits.${index}.accountId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] uppercase">Conta bancária</FormLabel>
                              <Select value={field.value} onValueChange={val => { field.onChange(val); handleAccountChange(index, val); }}>
                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField control={form.control} name={`splits.${index}.paymentMethodId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] uppercase">Forma</FormLabel>
                              <Select value={field.value} disabled={!accountId} onValueChange={val => { field.onChange(val); handleMethodChange(index, accountId, val); }}>
                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {account?.paymentMethods.map((pm: any) => <SelectItem key={pm.id} value={pm.id}>{pm.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-end gap-2">
                        <FormField control={form.control} name={`splits.${index}.amount`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-[10px] uppercase">Valor (R$)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" className="h-8 text-xs font-mono" placeholder="0,00" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        {fields.length > 1 && (
                          <Button type="button" variant="ghost" className="h-8 px-2 text-[10px] uppercase" onClick={() => fillRemaining(index)}>Restante</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={cn(
                'flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all',
                isExact ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' : 
                isOver ? 'border-rose-500/30 bg-rose-500/5 text-rose-500' : 'border-amber-500/30 bg-amber-500/5 text-amber-500'
              )}>
                <div className="flex items-center gap-2">
                  {isExact ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span className="font-medium">{isExact ? 'Valor conferido' : isOver ? 'Valor excedido' : 'Falta alocar'}</span>
                </div>
                <div className="text-right font-mono font-bold">
                  {formatCurrency(totalPaid)} / {formatCurrency(expense.totalValue)}
                </div>
              </div>
            </div>

            <FormField control={form.control} name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas do pagamento (opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Ex: comprovante enviado por whatsapp" {...field} /></FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || isOver || activeAccounts.length === 0}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar pagamento
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
