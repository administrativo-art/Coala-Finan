'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { expenseFormSchema, type ExpenseFormValues } from '@/lib/schemas';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, PlusCircle, Trash2, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { format, addMonths, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { EconomicPreview } from './economic-preview';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurrencyInput } from '@/components/ui/currency-input';

interface CalculatedInstallment {
  number: number;
  dueDate: Date;
  value: number;
}

type AccountPlan = { id: string; name: string; parentId: string | null };

const buildTree = (items: AccountPlan[], parentId: string | null = null): any[] =>
  items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({ ...item, children: buildTree(items, item.id) }));

const flattenTree = (nodes: any[], level = 0): any[] =>
  nodes.flatMap((node) => [
    { ...node, level, isParent: node.children.length > 0 },
    ...flattenTree(node.children, level + 1),
  ]);

const STEPS = [
  { id: 1, label: 'Classificação', fields: ['accountPlan', 'description'] },
  { id: 2, label: 'Valores', fields: ['totalValue', 'competenceDate', 'paymentMethod'] },
  { id: 3, label: 'Resultado', fields: ['isApportioned', 'resultCenter'] },
  { id: 4, label: 'Complemento', fields: ['supplier', 'notes'] },
];

function Stepper({ progressPercent }: { progressPercent: number }) {
  // O Stepper agora é puramente visual baseado no progresso real dos campos
  const currentStep = useMemo(() => {
    if (progressPercent < 25) return 1;
    if (progressPercent < 50) return 2;
    if (progressPercent < 75) return 3;
    return 4;
  }, [progressPercent]);

  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300',
                progressPercent >= (step.id / STEPS.length) * 100 || currentStep > step.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : currentStep === step.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted-foreground/30 text-muted-foreground'
              )}
            >
              {progressPercent >= (step.id / STEPS.length) * 100 ? <Check className="h-4 w-4" /> : step.id}
            </div>
            <span
              className={cn(
                'hidden text-xs font-medium sm:block transition-colors duration-300',
                currentStep === step.id ? 'text-primary' : 'text-muted-foreground text-center'
              )}
            >
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={cn(
                'h-[2px] flex-1 transition-all duration-500 mx-2 mb-4',
                progressPercent >= ((index + 1) / STEPS.length) * 100 ? 'bg-primary' : 'bg-muted-foreground/20'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ExpenseForm() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  const accountPlansCollection = useMemo(() => (firestore ? collection(firestore, 'accountPlans') : null), [firestore]);
  const { data: accountPlans, loading: accountPlansLoading } = useCollection(accountPlansCollection);

  const resultCentersCollection = useMemo(() => (firestore ? collection(firestore, 'resultCenters') : null), [firestore]);
  const { data: resultCenters, loading: resultCentersLoading } = useCollection(resultCentersCollection);

  const flattenedAccounts = useMemo(() => {
    if (!accountPlans) return [];
    const tree = buildTree(accountPlans as AccountPlan[]);
    return flattenTree(tree);
  }, [accountPlans]);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      isApportioned: false,
      paymentMethod: 'single',
      apportionments: [{ resultCenter: '', percentage: 100 }],
      variedInstallments: [],
      accountPlan: '',
      description: '',
      supplier: '',
      notes: '',
      resultCenter: '',
      totalValue: 0,
      installments: 2,
    },
    mode: 'onChange',
  });

  const { fields: apportionmentFields, append: appendApportionment, remove: removeApportionment } = useFieldArray({
    control: form.control,
    name: 'apportionments',
  });

  const { fields: installmentFields, append: appendInstallment, remove: removeInstallment } = useFieldArray({
    control: form.control,
    name: 'variedInstallments',
  });

  const [equalInstallments, setEqualInstallments] = useState<CalculatedInstallment[]>([]);

  const watchedAll = form.watch();
  const isApportioned = watchedAll.isApportioned;
  const paymentMethod = watchedAll.paymentMethod;
  const installmentType = watchedAll.installmentType;
  const installmentsQty = watchedAll.installments;
  const totalValue = watchedAll.totalValue;
  const firstInstallmentDueDate = watchedAll.firstInstallmentDueDate;
  const installmentPeriodicity = watchedAll.installmentPeriodicity;
  const variedInstallments = watchedAll.variedInstallments;

  const progressPercent = useMemo(() => {
    const checks = [
      !!watchedAll.accountPlan,
      !!watchedAll.description && watchedAll.description.length >= 10,
      !!watchedAll.totalValue && watchedAll.totalValue > 0,
      !!watchedAll.competenceDate,
      watchedAll.paymentMethod === 'installments' ? !!watchedAll.installmentType : !!watchedAll.dueDate,
      watchedAll.isApportioned ? (watchedAll.apportionments?.length ?? 0) > 0 : !!watchedAll.resultCenter,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [watchedAll]);

  const variedInstallmentsTotal = variedInstallments?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;
  const variedInstallmentsDifference = (totalValue || 0) - variedInstallmentsTotal;

  async function onSubmit(data: ExpenseFormValues) {
    if (!firestore || !user) return;
    setIsSaving(true);

    try {
      const installmentsToSave =
        data.paymentMethod === 'installments' && data.installmentType === 'equal'
          ? equalInstallments.map((i) => ({
              number: i.number,
              dueDate: Timestamp.fromDate(i.dueDate),
              value: i.value,
              status: 'pending',
            }))
          : data.paymentMethod === 'installments' && data.installmentType === 'varied'
          ? data.variedInstallments!.map((i, idx) => ({
              number: idx + 1,
              dueDate: Timestamp.fromDate(i.dueDate),
              value: i.value,
              status: 'pending',
            }))
          : [
              {
                number: 1,
                dueDate: Timestamp.fromDate(data.dueDate!),
                value: data.totalValue,
                status: 'pending',
              },
            ];

      const accountPlanObj = accountPlans?.find((ap) => ap.id === data.accountPlan);
      const accountPlanName = accountPlanObj ? accountPlanObj.name : data.accountPlan;

      await addDoc(collection(firestore, 'expenses'), {
        accountPlan: data.accountPlan,
        accountPlanName: accountPlanName,
        description: data.description,
        supplier: data.supplier ?? '',
        notes: data.notes ?? '',
        totalValue: data.totalValue,
        competenceDate: Timestamp.fromDate(data.competenceDate),
        dueDate: Timestamp.fromDate(
          data.paymentMethod === 'installments'
            ? data.installmentType === 'equal'
              ? data.firstInstallmentDueDate!
              : data.variedInstallments![0].dueDate
            : data.dueDate!
        ),
        paymentMethod: data.paymentMethod,
        isApportioned: data.isApportioned,
        resultCenter: data.isApportioned ? null : (data.resultCenter ?? null),
        apportionments: data.isApportioned ? data.apportionments : null,
        installments: installmentsToSave,
        status: 'pending',
        createdAt: Timestamp.now(),
        createdBy: user.uid,
      });

      toast({
        title: 'Despesa Lançada!',
        description: 'A provisão foi criada com sucesso no sistema.',
      });
      form.reset();
      setEqualInstallments([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a despesa no banco de dados.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (paymentMethod === 'installments' && installmentType === 'varied' && installmentsQty && installmentsQty >= 2) {
      const currentFields = variedInstallments || [];
      if (installmentsQty > currentFields.length) {
        const toAdd = installmentsQty - currentFields.length;
        const baseValue = (totalValue || 0) / installmentsQty;
        for (let i = 0; i < toAdd; i++) {
          appendInstallment(
            { dueDate: new Date(), value: baseValue > 0 ? parseFloat(baseValue.toFixed(2)) : 0 },
            { shouldFocus: false }
          );
        }
      } else if (installmentsQty < currentFields.length) {
        const toRemove = currentFields.length - installmentsQty;
        for (let i = 0; i < toRemove; i++) {
          removeInstallment(currentFields.length - 1 - i);
        }
      }
    }
  }, [installmentsQty, installmentType, paymentMethod, totalValue, appendInstallment, removeInstallment, variedInstallments]);

  useEffect(() => {
    if (paymentMethod === 'single') {
      form.setValue('installments', undefined);
      form.setValue('installmentType', undefined);
      form.setValue('variedInstallments', []);
    }
  }, [paymentMethod, form]);

  useEffect(() => {
    if (installmentType === 'equal') {
      form.setValue('variedInstallments', []);
    } else if (installmentType === 'varied') {
      setEqualInstallments([]);
    }
  }, [installmentType, form]);

  useEffect(() => {
    if (
      paymentMethod === 'installments' &&
      installmentType === 'equal' &&
      totalValue &&
      totalValue > 0 &&
      installmentsQty &&
      installmentsQty >= 2 &&
      firstInstallmentDueDate
    ) {
      const baseValue = Math.floor((totalValue * 100) / installmentsQty) / 100;
      const remainder = parseFloat((totalValue - baseValue * installmentsQty).toFixed(2));
      const installments: CalculatedInstallment[] = [];

      for (let i = 0; i < installmentsQty; i++) {
        let dueDate: Date;
        switch (installmentPeriodicity) {
          case 'weekly':
            dueDate = addWeeks(firstInstallmentDueDate, i);
            break;
          case 'biweekly':
            dueDate = addWeeks(firstInstallmentDueDate, i * 2);
            break;
          case 'monthly':
          default:
            dueDate = addMonths(firstInstallmentDueDate, i);
            break;
        }

        installments.push({
          number: i + 1,
          dueDate,
          value: i === installmentsQty - 1 ? baseValue + remainder : baseValue,
        });
      }
      setEqualInstallments(installments);
    } else {
      setEqualInstallments([]);
    }
  }, [totalValue, installmentsQty, firstInstallmentDueDate, installmentPeriodicity, installmentType, paymentMethod]);

  return (
    <Form {...form}>
      <div className="mb-6 space-y-4">
        <Stepper progressPercent={progressPercent} />

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso do preenchimento</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-primary'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
        <div className="space-y-8 lg:col-span-2">
          {/* ETAPA 1: CLASSIFICAÇÃO */}
          <Card className="transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  1
                </div>
                <div>
                  <CardTitle>Classificação</CardTitle>
                  <CardDescription>Plano de contas e descrição da despesa.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="accountPlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plano de Contas</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={accountPlansLoading}>
                          <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {flattenedAccounts?.map((account) => (
                          <SelectItem key={account.id} value={account.id} disabled={account.isParent}>
                            <span style={{ paddingLeft: `${account.level * 1.5}rem` }}>{account.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição da Despesa</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Compra de material de escritório" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>No mínimo 10 caracteres.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ETAPA 2: VALORES E DATAS */}
          <div className="space-y-8">
            <Card className="transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    2
                  </div>
                  <div>
                    <CardTitle>Valores e Datas</CardTitle>
                    <CardDescription>Defina o valor e as datas de vencimento.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="totalValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onValueChange={(values) => field.onChange(values.floatValue ?? 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="competenceDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col pt-2">
                      <FormLabel>Data de Competência</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                            >
                              {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
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
                {paymentMethod === 'single' && (
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col pt-2">
                        <FormLabel>Vencimento</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                              >
                                {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
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
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pagamento e Parcelamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a forma de pagamento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">À Vista</SelectItem>
                          <SelectItem value="installments">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {paymentMethod === 'installments' && (
                  <>
                    <Separator />
                    <FormField
                      control={form.control}
                      name="installmentType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Tipo de Parcelamento</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                              className="flex space-x-4 pt-2"
                            >
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <RadioGroupItem value="equal" id="equal-installments" />
                                </FormControl>
                                <FormLabel htmlFor="equal-installments" className="font-normal cursor-pointer">
                                  Parcelas Iguais
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <RadioGroupItem value="varied" id="varied-installments" />
                                </FormControl>
                                <FormLabel htmlFor="varied-installments" className="font-normal cursor-pointer">
                                  Valores Diferentes
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {installmentType === 'equal' && (
                      <div className="space-y-4 rounded-md border p-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name="installments"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Qtde. Parcelas</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={2}
                                    placeholder="Ex: 12"
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                    value={field.value ?? 2}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="firstInstallmentDueDate"
                            render={({ field }) => (
                              <FormItem className="flex flex-col pt-2">
                                <FormLabel>1º Vencimento</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          'pl-3 text-left font-normal',
                                          !field.value && 'text-muted-foreground'
                                        )}
                                      >
                                        {field.value ? (
                                          format(field.value, 'PPP', { locale: ptBR })
                                        ) : (
                                          <span>Escolha a data</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      onSelect={field.onChange}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="installmentPeriodicity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Periodicidade</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="monthly">Mensal</SelectItem>
                                    <SelectItem value="weekly">Semanal</SelectItem>
                                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        {equalInstallments.length > 0 && (
                          <div className="space-y-2">
                            <Label>Parcelas Geradas (Somente Leitura)</Label>
                            <ScrollArea className="h-48 rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[80px]">Parcela</TableHead>
                                    <TableHead>Vencimento</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {equalInstallments.map((inst) => (
                                    <TableRow key={inst.number}>
                                      <TableCell>{inst.number}</TableCell>
                                      <TableCell>{format(inst.dueDate, 'dd/MM/yyyy')}</TableCell>
                                      <TableCell className="text-right">
                                        {new Intl.NumberFormat('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        }).format(inst.value)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    )}

                    {installmentType === 'varied' && (
                      <div className="space-y-4 rounded-md border p-4">
                        <FormField
                          control={form.control}
                          name="installments"
                          render={({ field }) => (
                            <FormItem className="max-w-xs">
                              <FormLabel>Quantidade de Parcelas</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={2}
                                  placeholder="Ex: 3"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                  value={field.value ?? 2}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {installmentFields.length > 0 && <Separator />}

                        <div className="space-y-2">
                          {installmentFields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-[1fr,1fr,auto] items-end gap-2">
                              <FormField
                                control={form.control}
                                name={`variedInstallments.${index}.dueDate`}
                                render={({ field }) => (
                                  <FormItem>
                                    {index === 0 && <FormLabel>Vencimento</FormLabel>}
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <FormControl>
                                          <Button
                                            variant="outline"
                                            className={cn(
                                              'w-full pl-3 text-left font-normal',
                                              !field.value && 'text-muted-foreground'
                                            )}
                                          >
                                            {field.value ? (
                                              format(field.value, 'PPP', { locale: ptBR })
                                            ) : (
                                              <span>Data</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                          </Button>
                                        </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={field.value}
                                          onSelect={field.onChange}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`variedInstallments.${index}.value`}
                                render={({ field }) => (
                                  <FormItem>
                                    {index === 0 && <FormLabel>Valor</FormLabel>}
                                    <FormControl>
                                      <CurrencyInput
                                        value={field.value}
                                        onValueChange={(values) => field.onChange(values.floatValue ?? 0)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeInstallment(index)}
                                  disabled={installmentFields.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {variedInstallments && variedInstallments.length > 0 && (
                          <CardFooter className="flex-col items-stretch gap-2 rounded-lg border bg-muted/50 p-4 mt-4">
                            <div className="flex justify-between text-sm font-medium">
                              <span>Total das Parcelas:</span>
                              <span>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  variedInstallmentsTotal
                                )}
                              </span>
                            </div>
                            <div
                              className={cn(
                                'flex justify-between text-sm font-medium',
                                Math.abs(variedInstallmentsDifference) > 0.01 ? 'text-destructive' : 'text-emerald-500'
                              )}
                            >
                              <span>Diferença:</span>
                              <span>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  variedInstallmentsDifference
                                )}
                              </span>
                            </div>
                            {form.formState.errors.variedInstallments && (
                              <FormMessage>{form.formState.errors.variedInstallments.message}</FormMessage>
                            )}
                          </CardFooter>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ETAPA 3: CENTRO DE RESULTADO */}
          <Card className="transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  3
                </div>
                <div>
                  <CardTitle>Centro de Resultado e Rateio</CardTitle>
                  <CardDescription>Aloque a despesa nos centros de resultado.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="isApportioned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Ratear esta despesa?</FormLabel>
                      <FormDescription>Distribuir o valor entre múltiplos centros de resultado.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {!isApportioned ? (
                <FormField
                  control={form.control}
                  name="resultCenter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Resultado</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger disabled={resultCentersLoading}>
                            <SelectValue placeholder="Selecione um centro de resultado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {resultCenters?.map((rc) => (
                            <SelectItem key={rc.id} value={rc.name}>
                              {rc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const total = (form.watch('apportionments') || []).reduce((sum, a) => sum + (a.percentage || 0), 0);
                    const diff = 100 - total;
                    const isValid = Math.abs(diff) < 0.001;
                    return (
                      <div
                        className={cn(
                          'flex items-center justify-between rounded-md border p-3 text-sm',
                          isValid ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-amber-500/50 bg-amber-500/10'
                        )}
                      >
                        <span className="text-muted-foreground">Total alocado:</span>
                        <div className="flex items-center gap-2">
                          <span className={cn('font-bold', isValid ? 'text-emerald-500' : 'text-amber-500')}>
                            {total.toFixed(1)}%
                          </span>
                          {!isValid && (
                            <span className="text-xs text-amber-500">
                              ({diff > 0 ? `faltam ${diff.toFixed(1)}%` : `excesso de ${Math.abs(diff).toFixed(1)}%`})
                            </span>
                          )}
                          {isValid && <span className="text-xs text-emerald-500">✓ 100%</span>}
                        </div>
                      </div>
                    );
                  })()}

                  {apportionmentFields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2">
                      <FormField
                        control={form.control}
                        name={`apportionments.${index}.resultCenter`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            {index === 0 && <FormLabel>Centro de Resultado</FormLabel>}
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl>
                                <SelectTrigger disabled={resultCentersLoading}>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {resultCenters?.map((rc) => (
                                  <SelectItem key={rc.id} value={rc.name}>
                                    {rc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`apportionments.${index}.percentage`}
                        render={({ field }) => (
                          <FormItem className="w-28">
                            {index === 0 && <FormLabel>Perc. (%)</FormLabel>}
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="%"
                                {...field}
                                onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeApportionment(index)}
                        disabled={apportionmentFields.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendApportionment({ resultCenter: '', percentage: 0 })}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Rateio
                  </Button>
                  {form.formState.errors.apportionments && (
                    <FormMessage>{form.formState.errors.apportionments.message}</FormMessage>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ETAPA 4: COMPLEMENTO */}
          <Card className="transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  4
                </div>
                <div>
                  <CardTitle>Complemento</CardTitle>
                  <CardDescription>Informações adicionais da despesa.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Fornecedor</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Nome do Fornecedor LTDA" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas Adicionais</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalhes adicionais sobre a despesa..."
                        className="min-h-[120px]"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !form.formState.isValid}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lançar Despesa
            </Button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <EconomicPreview />
        </div>
      </form>
    </Form>
  );
}
