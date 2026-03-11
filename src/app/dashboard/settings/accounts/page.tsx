'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { bankAccountSchema, type BankAccountFormValues } from '@/lib/schemas';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Trash2, PlusCircle, X, Building2, CreditCard, Banknote, Landmark, Smartphone, Wallet } from 'lucide-react';

const PAYMENT_TYPES = [
  { value: 'debit_card', label: 'Cartão de débito', icon: CreditCard, color: 'text-emerald-400' },
  { value: 'credit_card', label: 'Cartão de crédito', icon: CreditCard, color: 'text-sky-400' },
  { value: 'pix', label: 'PIX', icon: Smartphone, color: 'text-teal-400' },
  { value: 'transfer', label: 'Transferência', icon: Landmark, color: 'text-violet-400' },
  { value: 'cash', label: 'Dinheiro', icon: Banknote, color: 'text-amber-400' },
] as const;

function PaymentMethodIcon({ type }: { type: string }) {
  const typeInfo = PAYMENT_TYPES.find(t => t.value === type);
  const Icon = typeInfo?.icon || Wallet;
  const color = typeInfo?.color || 'text-muted-foreground';
  return <Icon className={`h-3.5 w-3.5 ${color}`} />;
}

export default function AccountsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const accountsRef = useMemo(() => (firestore ? collection(firestore, 'bankAccounts') : null), [firestore]);
  const { data: accountsData, loading } = useCollection<any>(accountsRef);
  const accounts = accountsData || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      name: '',
      agency: '',
      accountNumber: '',
      active: true,
      paymentMethods: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'paymentMethods',
  });

  function openCreate() {
    setEditTarget(null);
    form.reset({
      name: '',
      agency: '',
      accountNumber: '',
      active: true,
      paymentMethods: [{ id: crypto.randomUUID(), type: 'pix', label: 'PIX principal' }],
    });
    setDialogOpen(true);
  }

  function openEdit(account: any) {
    setEditTarget(account);
    form.reset({
      name: account.name,
      agency: account.agency || '',
      accountNumber: account.accountNumber || '',
      active: account.active,
      paymentMethods: account.paymentMethods,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: BankAccountFormValues) {
    if (!firestore || !user) return;
    setIsSaving(true);
    try {
      if (editTarget) {
        await updateDoc(doc(firestore, 'bankAccounts', editTarget.id), values);
        toast({ title: 'Conta atualizada com sucesso!' });
      } else {
        await addDoc(collection(firestore, 'bankAccounts'), {
          ...values,
          createdBy: user.uid,
          createdAt: Timestamp.now(),
        });
        toast({ title: 'Conta criada com sucesso!' });
      }
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Erro ao salvar conta.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!firestore || !deleteTarget) return;
    try {
      await deleteDoc(doc(firestore, 'bankAccounts', deleteTarget.id));
      toast({ title: 'Conta removida com sucesso.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao remover conta.' });
    } finally {
      setDeleteTarget(null);
    }
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditTarget(null);
    form.reset();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Contas bancárias</h1>
          <p className="text-muted-foreground">Gerencie suas instituições financeiras e formas de pagamento.</p>
        </div>
        <Button onClick={openCreate} className="shadow-lg">
          <Plus className="mr-2 h-4 w-4" /> Nova conta
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium">Nenhuma conta cadastrada</p>
          <p className="mb-6 text-sm text-muted-foreground">Comece adicionando seu banco principal.</p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar primeiro banco
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((account: any) => (
            <Card key={account.id} className={`${!account.active ? 'opacity-60 grayscale' : ''} border-border/50 bg-card/50 shadow-sm backdrop-blur transition-all hover:bg-card/80`}>
              <CardContent className="flex flex-col sm:flex-row sm:items-start gap-4 p-5">
                <div className="min-w-[220px]">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base truncate max-w-[120px]">{account.name}</h3>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(account)} className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(account)} className="h-7 w-7 text-rose-500 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {(account.agency || account.accountNumber) && (
                    <div className="flex gap-3 text-xs text-muted-foreground mb-3">
                      {account.agency && <span>Ag: {account.agency}</span>}
                      {account.accountNumber && <span>CC: {account.accountNumber}</span>}
                    </div>
                  )}
                  <Badge variant={account.active ? 'default' : 'secondary'} className="text-[10px] uppercase tracking-wider">
                    {account.active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>

                <div className="hidden sm:block w-px self-stretch bg-border/20" />

                <div className="flex flex-1 flex-wrap gap-2 items-center">
                  {account.paymentMethods.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma forma de pagamento cadastrada.</p>
                  ) : (
                    account.paymentMethods.map((pm: any) => (
                      <div key={pm.id}
                        className="flex items-center gap-1.5 rounded-full border border-border/30 bg-white/5 px-3 py-1.5 text-xs shadow-sm transition-colors hover:border-border/50"
                      >
                        <PaymentMethodIcon type={pm.type} />
                        <span className="font-medium">{pm.label}</span>
                        {pm.lastDigits && (
                          <span className="text-muted-foreground">•••• {pm.lastDigits}</span>
                        )}
                      </div>
                    ))
                  )}
                  <p className="w-full text-[10px] text-muted-foreground mt-1 opacity-60">
                    {account.paymentMethods.length} forma{account.paymentMethods.length !== 1 ? 's' : ''} de pagamento disponível
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">
              {editTarget ? 'Editar conta' : 'Nova conta bancária'}
            </DialogTitle>
            <DialogDescription>Configure os dados do banco e as formas de pagamento disponíveis.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 overflow-y-auto pr-2 pb-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Nome da instituição</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Itaú, Nubank, Caixa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agência (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="0001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da conta (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="12345-6" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Conta ativa</FormLabel>
                      <CardDescription className="text-xs">Contas inativas não aparecem em novos lançamentos.</CardDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Formas de pagamento</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ id: crypto.randomUUID(), type: 'debit_card', label: '' })}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar forma
                  </Button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const type = form.watch(`paymentMethods.${index}.type`);
                    return (
                      <Card key={field.id} className="relative bg-muted/30 border-primary/10">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-7 w-7 text-rose-500 hover:bg-rose-50"
                          onClick={() => remove(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <CardContent className="pt-6 grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`paymentMethods.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Tipo</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {PAYMENT_TYPES.map(type => (
                                      <SelectItem key={type.value} value={type.value}>
                                        <div className="flex items-center gap-2">
                                          <type.icon className="h-4 w-4" />
                                          {type.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`paymentMethods.${index}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Rótulo / nome</FormLabel>
                                <FormControl>
                                  <Input className="h-9" placeholder="Ex: Visa Gold, PIX CNPJ" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {(type === 'debit_card' || type === 'credit_card') && (
                            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
                              <FormField
                                control={form.control}
                                name={`paymentMethods.${index}.cardNumber`}
                                render={({ field }) => (
                                  <FormItem className="sm:col-span-2">
                                    <FormLabel className="text-xs">Número do cartão (opcional)</FormLabel>
                                    <FormControl>
                                      <Input
                                        className="h-9 font-mono tracking-widest"
                                        placeholder="0000 0000 0000 0000"
                                        maxLength={19}
                                        {...field}
                                        onChange={e => {
                                          const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
                                          const masked = raw.replace(/(.{4})/g, '$1 ').trim();
                                          field.onChange(masked);
                                          if (raw.length >= 4) {
                                            form.setValue(`paymentMethods.${index}.lastDigits`, raw.slice(-4));
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <FormDescription className="text-[10px]">Preencha para atualizar os dígitos finais automaticamente.</FormDescription>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`paymentMethods.${index}.lastDigits`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Dígitos finais</FormLabel>
                                    <FormControl>
                                      <Input className="h-9" placeholder="1234" maxLength={4} {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              {type === 'credit_card' && (
                                <FormField
                                  control={form.control}
                                  name={`paymentMethods.${index}.limit`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Limite (R$)</FormLabel>
                                      <FormControl>
                                        <Input className="h-9" type="number" placeholder="5000" {...field} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>
                          )}

                          {type === 'pix' && (
                            <FormField
                              control={form.control}
                              name={`paymentMethods.${index}.pixKey`}
                              render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                  <FormLabel className="text-xs">Chave PIX</FormLabel>
                                  <FormControl>
                                    <Input className="h-9" placeholder="E-mail, CPF, CNPJ ou chave aleatória" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {form.formState.errors.paymentMethods && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.paymentMethods.message}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="sticky bottom-0 bg-popover pt-4">
                <Button type="button" variant="outline" onClick={handleDialogClose}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editTarget ? 'Salvar alterações' : 'Criar conta'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta bancária?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a conta <strong>{deleteTarget?.name}</strong> e todas as suas formas de pagamento. 
              Lançamentos financeiros já realizados não serão afetados, mas a conta não estará mais disponível para novos registros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600">
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
