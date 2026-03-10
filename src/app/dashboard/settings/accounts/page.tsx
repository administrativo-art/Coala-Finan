'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { bankAccountSchema, type BankAccountFormValues, type PaymentMethodValues } from '@/lib/schemas';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Trash2, PlusCircle, X, Building2, CreditCard, Banknote, Landmark, Smartphone } from 'lucide-react';

const PAYMENT_TYPES = [
  { value: 'debit_card', label: 'Cartão de débito', icon: CreditCard },
  { value: 'credit_card', label: 'Cartão de crédito', icon: CreditCard },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'transfer', label: 'Transferência', icon: Landmark },
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
] as const;

export default function AccountsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const accountsRef = useMemo(() => (firestore ? collection(firestore, 'bankAccounts') : null), [firestore]);
  const { data: accounts = [], loading } = useCollection<any>(accountsRef);

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
      paymentMethods: [{ id: crypto.randomUUID(), type: 'pix', label: 'PIX Principal' }],
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account: any) => (
            <Card key={account.id} className={!account.active ? 'opacity-60 grayscale' : 'hover:shadow-xl transition-shadow'}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-headline">{account.name}</CardTitle>
                    <CardDescription className="flex gap-2 text-xs">
                      {account.agency && <span>Ag: {account.agency}</span>}
                      {account.accountNumber && <span>CC: {account.accountNumber}</span>}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(account)} className="h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(account)} className="h-8 w-8 text-rose-500 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {account.paymentMethods.map((pm: any) => {
                    const typeInfo = PAYMENT_TYPES.find(t => t.value === pm.type);
                    const Icon = typeInfo?.icon || CreditCard;
                    return (
                      <Badge key={pm.id} variant="secondary" className="flex items-center gap-1.5 py-1">
                        <Icon className="h-3 w-3" />
                        {pm.label}
                      </Badge>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Badge variant={account.active ? 'default' : 'outline'}>
                    {account.active ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {account.paymentMethods.length} formas de pagamento
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  {fields.map((field, index) => (
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
                      </CardContent>
                    </Card>
                  ))}
                  {form.formState.errors.paymentMethods && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.paymentMethods.message}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="sticky bottom-0 bg-popover pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
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
