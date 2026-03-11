'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  collection,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { userFormSchema, type UserFormValues } from '@/lib/schemas';
import { useCollection, useFirestore, useUser } from '@/firebase';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, MoreHorizontal, UserPlus, ShieldCheck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createUserAction } from '../actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type UserProfile = UserProfileData & { id: string };
interface UserProfileData {
  name: string;
  email: string;
  profile?: string;
}

export default function UsersManagement() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: authUser } = useUser();

  const usersCollection = useMemo(() => (firestore ? collection(firestore, 'users') : null), [firestore]);
  const { data: users, loading: usersLoading } = useCollection(usersCollection);

  const profilesCollection = useMemo(() => (firestore ? collection(firestore, 'accessProfiles') : null), [firestore]);
  const { data: profiles, loading: profilesLoading } = useCollection(profilesCollection);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: '', email: '', profile: '', password: '' },
  });

  const handleDialogOpen = (user: UserProfile | null = null) => {
    setEditingUser(user);
    form.reset(user ? { name: user.name, email: user.email, profile: user.profile || '', password: '' } : { name: '', email: '', profile: '', password: '' });
    setIsFormOpen(true);
  };

  const handleDialogClose = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  const onSubmit = async (values: UserFormValues) => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      if (editingUser) {
        // Editar usuário existente no Firestore
        const { password, ...updateData } = values;
        await setDoc(doc(firestore, 'users', editingUser.id), updateData, { merge: true });
        toast({ title: 'Usuário atualizado com sucesso!' });
        handleDialogClose();
      } else {
        // Criar novo usuário usando Server Action
        const result = await createUserAction({
          name: values.name,
          email: values.email,
          password: values.password || '',
          profile: values.profile || '',
        });

        if (result.success) {
          toast({ title: 'Usuário criado com sucesso!' });
          handleDialogClose();
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro ao criar usuário',
            description: result.error,
          });
        }
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o usuário.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !deletingId) return;

    if (deletingId === authUser?.uid) {
      toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description: 'Você não pode excluir seu próprio usuário.',
      });
      setIsAlertOpen(false);
      return;
    }

    try {
      await deleteDoc(doc(firestore, 'users', deletingId));
      toast({ title: 'Usuário excluído com sucesso!' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o usuário.',
      });
    } finally {
      setIsAlertOpen(false);
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de usuários</CardTitle>
        <CardDescription>
          Adicione, edite ou remova usuários do sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-end">
          <Button onClick={() => handleDialogOpen()}>
            <UserPlus className="mr-2 h-4 w-4" />
            Adicionar usuário
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : (
              users &&
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.profile || <span className="text-muted-foreground italic">Nenhum</span>}</TableCell>
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
                          onClick={() => handleDialogOpen(user as UserProfile)}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          onClick={() => {
                            setDeletingId(user.id);
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

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar' : 'Adicionar'} usuário</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Atualize os dados do usuário no sistema.' : 'Crie um novo acesso. A senha será usada para o primeiro login.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="nome@empresa.com" {...field} readOnly={!!editingUser} disabled={!!editingUser} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!editingUser && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha inicial</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 6 caracteres" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>Essa senha será exigida no primeiro acesso.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="profile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil de acesso (opcional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger disabled={profilesLoading}>
                          <SelectValue placeholder="Selecione um perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {profiles?.map((p) => (
                          <SelectItem key={p.id} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert variant="default" className="bg-emerald-500/5 border-emerald-500/20">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <AlertTitle className="text-xs font-semibold text-emerald-500">Autenticação segura via IAM</AlertTitle>
                <AlertDescription className="text-[10px] leading-tight text-muted-foreground">
                  O sistema está configurado para usar a identidade do servidor (ADC). Certifique-se de que a conta de serviço tem as permissões necessárias no Console do Google Cloud.
                </AlertDescription>
              </Alert>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDialogClose}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingUser ? 'Salvar alterações' : 'Criar usuário'}
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
              Esta ação excluirá o perfil do usuário do banco de dados. O acesso no Firebase Auth não será removido automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
