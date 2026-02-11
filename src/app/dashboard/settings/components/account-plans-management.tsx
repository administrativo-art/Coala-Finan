
'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDoc, collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import {
  AccountPlanFormValues,
  accountPlanFormSchema,
} from '@/lib/schemas';
import { useCollection, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MoreHorizontal, PlusCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AccountPlan = AccountPlanFormValues & { id: string, children?: AccountPlan[], level?: number };

const buildTree = (items: AccountPlan[], parentId: string | null = null): AccountPlan[] =>
  items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({ ...item, children: buildTree(items, item.id) }));

const flattenTree = (nodes: AccountPlan[], level = 0): AccountPlan[] =>
  nodes.flatMap((node) => [
    { ...node, level },
    ...flattenTree(node.children || [], level + 1),
  ]);

export default function AccountPlansManagement() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const accountPlansCollection = useMemo(() => (firestore ? collection(firestore, 'accountPlans') : null), [firestore]);
  const {
    data: rawAccountPlans,
    loading: loading,
  } = useCollection(accountPlansCollection);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAccountPlan, setEditingAccountPlan] = useState<AccountPlan | null>(
    null
  );

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<AccountPlanFormValues>({
    resolver: zodResolver(accountPlanFormSchema),
    defaultValues: { name: '', description: '', parentId: null },
  });

  const flattenedAccounts = useMemo(() => {
    if (!rawAccountPlans) return [];
    const tree = buildTree(rawAccountPlans as AccountPlan[], null);
    return flattenTree(tree);
  }, [rawAccountPlans]);

  const handleDialogOpen = (accountPlan: AccountPlan | null = null) => {
    setEditingAccountPlan(accountPlan);
    form.reset(accountPlan ? { name: accountPlan.name, description: accountPlan.description, parentId: accountPlan.parentId } : { name: '', description: '', parentId: null });
    setIsFormOpen(true);
  };

  const handleDialogClose = () => {
    setIsFormOpen(false);
    setEditingAccountPlan(null);
  };

  const onSubmit = async (values: AccountPlanFormValues) => {
    if (!firestore || !accountPlansCollection) return;
    setIsSaving(true);
    try {
      if (editingAccountPlan) {
        await setDoc(doc(firestore, 'accountPlans', editingAccountPlan.id), values);
        toast({ title: 'Conta atualizada com sucesso!' });
      } else {
        await addDoc(accountPlansCollection, values);
        toast({ title: 'Conta adicionada com sucesso!' });
      }
      handleDialogClose();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a conta.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !deletingId) return;
    try {
      await deleteDoc(doc(firestore, 'accountPlans', deletingId));
      toast({ title: 'Conta excluída com sucesso!' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a conta.',
      });
    } finally {
      setIsAlertOpen(false);
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plano de Contas</CardTitle>
        <CardDescription>
          Gerencie a estrutura hierárquica do seu plano de contas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-end">
          <Button onClick={() => handleDialogOpen()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Conta
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : (
              flattenedAccounts &&
              flattenedAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium" style={{ paddingLeft: `${(account.level || 0) * 1.5}rem` }}>
                    {account.name}
                  </TableCell>
                  <TableCell>{account.description}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          onClick={() => handleDialogOpen(account)}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          onClick={() => {
                            setDeletingId(account.id);
                            setIsAlertOpen(true);
                          }}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccountPlan ? 'Editar' : 'Adicionar'} Conta
            </DialogTitle>
            <DialogDescription>
              Preencha os detalhes da conta do plano de contas.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Despesas Administrativas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Breve descrição" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Pai (Opcional)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === '' ? null : value)} value={field.value || ''} >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma conta pai (se houver)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhuma (Conta Raiz)</SelectItem>
                        {flattenedAccounts.map((account) => (
                           <SelectItem key={account.id} value={account.id} disabled={editingAccountPlan?.id === account.id}>
                           <span style={{ paddingLeft: `${(account.level || 0) * 1}rem` }}>{account.name}</span>
                         </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDialogClose}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente a conta. Se houver contas filhas, elas ficarão órfãs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
