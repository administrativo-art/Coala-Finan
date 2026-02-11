'use client';

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
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { format, addMonths, addWeeks } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { EconomicPreview } from './economic-preview';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

const costCenters = [
  'Despesas Administrativas',
  'Marketing e Vendas',
  'Pesquisa e Desenvolvimento',
  'Custos Operacionais',
];
const resultCenters = ['Produto A', 'Produto B', 'Serviços', 'Corporativo'];

interface CalculatedInstallment {
  number: number;
  dueDate: Date;
  value: number;
}

export default function ExpenseForm() {
  const { toast } = useToast();
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      isApportioned: false,
      paymentMethod: 'single',
      apportionments: [{ resultCenter: '', percentage: 100 }],
      variedInstallments: [],
    },
    mode: 'onChange',
  });

  const { fields: apportionmentFields, append: appendApportionment, remove: removeApportionment } = useFieldArray({
    control: form.control,
    name: 'apportionments',
  });

  const { fields: installmentFields, append: appendInstallment, remove: removeInstallment, replace: replaceInstallments } = useFieldArray({
    control: form.control,
    name: 'variedInstallments',
  });

  const [equalInstallments, setEqualInstallments] = useState<CalculatedInstallment[]>([]);

  function onSubmit(data: ExpenseFormValues) {
    console.log(data);
    toast({
      title: 'Despesa Lançada!',
      description: 'A provisão foi criada com sucesso no sistema.',
    });
    form.reset();
  }

  const isApportioned = form.watch('isApportioned');
  const paymentMethod = form.watch('paymentMethod');
  const installmentType = form.watch('installmentType');
  const installmentsQty = form.watch('installments');
  const totalValue = form.watch('totalValue');
  const firstInstallmentDueDate = form.watch('firstInstallmentDueDate');
  const installmentPeriodicity = form.watch('installmentPeriodicity');
  const variedInstallments = form.watch('variedInstallments');

  const variedInstallmentsTotal = variedInstallments?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;
  const variedInstallmentsDifference = (totalValue || 0) - variedInstallmentsTotal;


  useEffect(() => {
    const qty = form.getValues('installments');
    const currentFields = form.getValues('variedInstallments') || [];

    if (paymentMethod === 'installments' && installmentType === 'varied' && qty && qty >= 2) {
      if (qty > currentFields.length) {
        const toAdd = qty - currentFields.length;
        const baseValue = totalValue / qty;
        for (let i = 0; i < toAdd; i++) {
          appendInstallment({ dueDate: new Date(), value: baseValue > 0 ? baseValue : 0 }, { shouldFocus: false });
        }
      } else if (qty < currentFields.length) {
        const toRemove = currentFields.length - qty;
        for (let i = 0; i < toRemove; i++) {
          removeInstallment(currentFields.length - 1 - i);
        }
      }
    }
  }, [installmentsQty, installmentType, paymentMethod, totalValue, appendInstallment, removeInstallment, form]);
  
  useEffect(() => {
    if(paymentMethod === 'single') {
        form.setValue('installments', undefined);
        form.setValue('installmentType', undefined);
    }
  }, [paymentMethod, form]);


  useEffect(() => {
    if (
      paymentMethod === 'installments' &&
      installmentType === 'equal' &&
      totalValue > 0 &&
      installmentsQty &&
      installmentsQty >= 2 &&
      firstInstallmentDueDate
    ) {
      const baseValue = Math.floor((totalValue * 100) / installmentsQty) / 100;
      const remainder = totalValue - baseValue * installmentsQty;
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Classificação</CardTitle>
              <CardDescription>Informações básicas para identificar a despesa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="costCenter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Centro de Custo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione um centro de custo" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {costCenters.map(cc => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valores e Datas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="totalValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="150,00" {...field} value={field.value ?? ''} />
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
                          <Button variant="outline" className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'PPP') : <span>Escolha uma data</span>}
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
               <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col pt-2">
                    <FormLabel>Vencimento Inicial</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'PPP') : <span>Escolha uma data</span>}
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
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
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
                            className="flex space-x-4 pt-2"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="equal" id="equal-installments" /></FormControl>
                              <FormLabel htmlFor="equal-installments" className="font-normal cursor-pointer">Parcelas Iguais</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="varied" id="varied-installments" /></FormControl>
                              <FormLabel htmlFor="varied-installments" className="font-normal cursor-pointer">Valores Diferentes</FormLabel>
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
                              <FormControl><Input type="number" min={2} placeholder="Ex: 12" {...field} value={field.value ?? ''} /></FormControl>
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
                                      <Button variant="outline" className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                        {field.value ? format(field.value, 'PPP') : <span>Escolha a data</span>}
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
                          <FormField
                            control={form.control}
                            name="installmentPeriodicity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Periodicidade</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                                        <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.value)}</TableCell>
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
                              <FormControl><Input type="number" min={2} placeholder="Ex: 3" {...field} value={field.value ?? ''} /></FormControl>
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
                                        <FormLabel>Vencimento</FormLabel>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <FormControl>
                                              <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                                {field.value ? format(field.value, 'PPP') : <span>Data</span>}
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
                                <FormField
                                    control={form.control}
                                    name={`variedInstallments.${index}.value`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Valor (R$)</FormLabel>
                                        <FormControl><Input type="number" placeholder="R$" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeInstallment(index)}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                              </div>
                            ))}
                        </div>

                        {variedInstallments && variedInstallments.length > 0 && (
                            <CardFooter className="flex-col items-stretch gap-2 rounded-lg border bg-muted/50 p-4">
                               <div className="flex justify-between text-sm font-medium">
                                 <span>Total das Parcelas:</span>
                                 <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(variedInstallmentsTotal)}</span>
                               </div>
                               <div className={cn("flex justify-between text-sm font-medium", variedInstallmentsDifference !== 0 ? 'text-destructive' : 'text-emerald-500')}>
                                 <span>Diferença:</span>
                                 <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(variedInstallmentsDifference)}</span>
                               </div>
                               <FormMessage>{form.formState.errors.variedInstallments?.message}</FormMessage>
                            </CardFooter>
                        )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle>Centro de Resultado e Rateio</CardTitle>
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
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione um centro de resultado" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {resultCenters.map(rc => <SelectItem key={rc} value={rc}>{rc}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="space-y-4">
                    {apportionmentFields.map((field, index) => (
                      <div key={field.id} className="flex items-end gap-2">
                         <FormField
                            control={form.control}
                            name={`apportionments.${index}.resultCenter`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Centro de Resultado</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {resultCenters.map(rc => <SelectItem key={rc} value={rc}>{rc}</SelectItem>)}
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
                                <FormLabel>Perc. (%)</FormLabel>
                                <FormControl><Input type="number" placeholder="%" {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeApportionment(index)} disabled={apportionmentFields.length <= 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendApportionment({ resultCenter: '', percentage: 0 })}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Rateio
                    </Button>
                    <FormMessage>{form.formState.errors.apportionments?.message}</FormMessage>
                  </div>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fornecedor</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas Adicionais</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detalhes adicionais sobre a despesa..." {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => form.reset()}>Cancelar</Button>
            <Button type="submit">Lançar Despesa</Button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <EconomicPreview />
        </div>
      </form>
    </Form>
  );
}
